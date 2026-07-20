import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import {
  sendRefundApprovedEmail,
  sendRefundDeniedEmail,
  sendLeadReturnedEmail,
} from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/refunds/[id]
 * Admin approves or denies a refund request.
 * Body: { action: "approve" | "deny", notes?: string }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();

  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const refundRequest = await prisma.refundRequest.findUnique({
    where: { id },
    include: {
      case: { select: { id: true, title: true, attorneyId: true } },
      attorney: { select: { id: true, email: true, name: true } },
    },
  });

  if (!refundRequest) {
    return NextResponse.json({ error: "Refund request not found" }, { status: 404 });
  }

  if (refundRequest.status !== "pending") {
    return NextResponse.json(
      { error: `Refund request already ${refundRequest.status}` },
      { status: 409 },
    );
  }

  let body: { action?: string; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action;
  if (action !== "approve" && action !== "deny") {
    return NextResponse.json({ error: "Action must be 'approve' or 'deny'" }, { status: 400 });
  }

  // ── Deny ──────────────────────────────────────────────────────────────────
  if (action === "deny") {
    await prisma.refundRequest.update({
      where: { id },
      data: {
        status: "denied",
        decidedAt: new Date(),
        decidedById: session.userId,
        decisionNotes: body.notes ?? null,
      },
    });

    logActivity({
      actor: session,
      caseId: refundRequest.caseId,
      caseTitle: refundRequest.case.title,
      action: "refund.denied",
      detail: body.notes ?? undefined,
    });

    sendRefundDeniedEmail({
      to: refundRequest.attorney.email,
      attorneyName: refundRequest.attorney.name ?? "Attorney",
      caseId: refundRequest.caseId,
      decisionNotes: body.notes,
    }).catch(() => {});

    return NextResponse.json({ ok: true, status: "denied" });
  }

  // ── Approve → Stripe refund → reset lead ──────────────────────────────────

  // Find the lead + payment for this case
  const lead = await prisma.lead.findFirst({
    where: { caseId: refundRequest.caseId },
    select: { id: true, email: true, name: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found for this case" }, { status: 404 });
  }

  const payment = await prisma.leadClaimPayment.findFirst({
    where: { leadId: lead.id, userId: refundRequest.attorneyId, status: "completed" },
    select: { id: true, stripeSessionId: true, amountCents: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "No completed payment found" }, { status: 400 });
  }

  // Retrieve the Stripe Checkout Session to get the payment intent
  let stripeRefundId: string | null = null;
  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
    const paymentIntentId = typeof checkoutSession.payment_intent === "string"
      ? checkoutSession.payment_intent
      : checkoutSession.payment_intent?.id;

    if (!paymentIntentId) {
      return NextResponse.json({ error: "No payment intent found for this checkout session" }, { status: 400 });
    }

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
    });

    stripeRefundId = refund.id;
    logger.log(`[refund] Stripe refund created: ${refund.id} for payment_intent ${paymentIntentId}`);
  } catch (err) {
    logger.error("[refund] Stripe refund failed:", err);
    return NextResponse.json(
      { error: "Stripe refund failed. Please try again or process manually." },
      { status: 502 },
    );
  }

  // Update refund request status
  await prisma.refundRequest.update({
    where: { id },
    data: {
      status: "refunded",
      decidedAt: new Date(),
      decidedById: session.userId,
      decisionNotes: body.notes ?? null,
      stripeRefundId,
    },
  });

  // Reset lead: unclaim and return to marketplace
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: "new",
      claimedByUserId: null,
      claimedAt: null,
      applicantStatus: "unclaimed",
      caseId: null,
    },
  });

  // Mark payment as refunded
  await prisma.leadClaimPayment.update({
    where: { id: payment.id },
    data: { status: "refunded" },
  });

  // Activity log
  logActivity({
    actor: session,
    caseId: refundRequest.caseId,
    caseTitle: refundRequest.case.title,
    action: "refund.approved",
    detail: `Stripe refund: ${stripeRefundId}. Lead returned to marketplace.`,
  });

  // Notify attorney
  sendRefundApprovedEmail({
    to: refundRequest.attorney.email,
    attorneyName: refundRequest.attorney.name ?? "Attorney",
    caseId: refundRequest.caseId,
    amountCents: payment.amountCents,
  }).catch(() => {});

  // Notify applicant
  sendLeadReturnedEmail({
    to: lead.email,
    applicantName: lead.name ?? undefined,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    status: "refunded",
    stripeRefundId,
  });
}
