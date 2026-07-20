import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attorneyTermsAcceptedInDb } from "@/lib/attorneyTerms";
import { isSubscriptionActive } from "@/lib/plans";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import { trackFunnel } from "@/lib/funnel";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

// POST /api/leads/[id]/claim — initiate a lead claim via Stripe Checkout ($150).
// The actual claim completes in the webhook after payment succeeds.
async function _POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Attorneys must have accepted the current platform terms before claiming
  // (money + exclusivity). The /network layout gates the UI; this covers
  // direct API calls. Admin (founder ops) bypasses.
  if (session.role === "attorney" && !(await attorneyTermsAcceptedInDb(session.userId))) {
    return NextResponse.json(
      { error: "Please accept the Attorney Platform Terms first.", code: "attorney_terms_required" },
      { status: 403 }
    );
  }

  // Admins bypass subscription + payment
  if (session.role === "admin") {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { autoConvertLead } = await import("@/lib/lead-convert");
    const { sendLeadClaimConsent } = await import("@/lib/email");
    const { issueToken, TTL } = await import("@/lib/tokens");

    const preApproved = lead.applicantStatus === "approved";
    const { count } = await prisma.lead.updateMany({
      where: { id, claimedByUserId: null },
      data: {
        claimedByUserId: session.userId,
        claimedAt: new Date(),
        status: "claimed",
        applicantStatus: preApproved ? "approved" : "pending_approval",
      },
    });
    if (count === 0) return NextResponse.json({ error: "Already claimed" }, { status: 409 });

    logActivity({ actor: session, action: "lead.claimed", detail: id });
    trackFunnel({ event: "lead.claimed", leadId: id, userId: session.userId });

    if (preApproved) {
      autoConvertLead(id).catch((e) => logger.error("[auto-convert] failed:", e));
    } else {
      const { plaintext: respondToken } = await issueToken({
        kind: "lead_consent", subjectType: "lead", subjectId: id,
        ttlMs: TTL.LEAD_CONSENT, createdById: session.userId,
      });
      sendLeadClaimConsent({
        to: lead.email, name: lead.name,
        attorneyName: session.name, respondToken,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, status: preApproved ? "approved" : "pending_approval" });
  }

  // Pilot-tier attorneys bypass subscription + payment (same as admin flow)
  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
    select: { networkTier: true },
  });

  if (firm?.networkTier === "pilot") {
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { autoConvertLead } = await import("@/lib/lead-convert");
    const { sendLeadClaimConsent } = await import("@/lib/email");
    const { issueToken, TTL } = await import("@/lib/tokens");

    const preApproved = lead.applicantStatus === "approved";
    const { count } = await prisma.lead.updateMany({
      where: { id, claimedByUserId: null },
      data: {
        claimedByUserId: session.userId,
        claimedAt: new Date(),
        status: "claimed",
        applicantStatus: preApproved ? "approved" : "pending_approval",
      },
    });
    if (count === 0) return NextResponse.json({ error: "Already claimed" }, { status: 409 });

    logActivity({ actor: session, action: "lead.claimed", detail: `${id} (pilot)` });
    trackFunnel({ event: "lead.claimed", leadId: id, userId: session.userId, props: { via: "pilot" } });

    if (preApproved) {
      autoConvertLead(id).catch((e) => logger.error("[auto-convert] failed:", e));
    } else {
      const { plaintext: respondToken } = await issueToken({
        kind: "lead_consent", subjectType: "lead", subjectId: id,
        ttlMs: TTL.LEAD_CONSENT, createdById: session.userId,
      });
      sendLeadClaimConsent({
        to: lead.email, name: lead.name,
        attorneyName: session.name, respondToken,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, status: preApproved ? "approved" : "pending_approval" });
  }

  // Attorney flow — require active subscription
  const subscribed = await isSubscriptionActive(session.userId);
  if (!subscribed) {
    return NextResponse.json({ error: "Subscription required" }, { status: 402 });
  }

  if (!STRIPE_PRICES.leadClaim) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lead.claimedByUserId) return NextResponse.json({ error: "Already claimed" }, { status: 409 });

  // Check for existing pending payment (user may have abandoned checkout)
  const existingPayment = await prisma.leadClaimPayment.findUnique({
    where: { leadId: id },
  });
  if (existingPayment && existingPayment.status === "completed") {
    return NextResponse.json({ error: "Already claimed" }, { status: 409 });
  }

  const billingFirm = await prisma.firmProfile.findUnique({ where: { userId: session.userId } });

  let customerId = billingFirm?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      name: billingFirm?.firmName ?? session.name,
      metadata: { userId: session.userId },
    });
    customerId = customer.id;
    await prisma.firmProfile.upsert({
      where: { userId: session.userId },
      update: { stripeCustomerId: customerId },
      create: { userId: session.userId, stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: STRIPE_PRICES.leadClaim, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/leads/${id}?claimed=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/leads/${id}`,
    metadata: { userId: session.userId, type: "lead_claim", leadId: id },
  });

  // Upsert payment record (handles abandoned checkout retry)
  if (existingPayment) {
    await prisma.leadClaimPayment.update({
      where: { id: existingPayment.id },
      data: { stripeSessionId: checkoutSession.id },
    });
  } else {
    await prisma.leadClaimPayment.create({
      data: {
        leadId: id,
        userId: session.userId,
        amountCents: 15000,
        stripeSessionId: checkoutSession.id,
      },
    });
  }

  logActivity({ actor: session, action: "lead.claim_initiated", detail: id });
  trackFunnel({ event: "lead.claimed", leadId: id, userId: session.userId, props: { via: "stripe" } });

  return NextResponse.json({ ok: true, checkoutUrl: checkoutSession.url });
}

export const POST = withRoute(_POST);
