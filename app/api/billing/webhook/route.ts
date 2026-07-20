import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { autoConvertLead } from "@/lib/lead-convert";
import { sendLeadClaimConsent } from "@/lib/email";
import { issueToken, TTL } from "@/lib/tokens";
import Stripe from "stripe";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

function log(level: "INFO" | "WARN" | "ERROR", event: string, data?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts:    new Date().toISOString(),
    level,
    svc:   "stripe-webhook",
    event,
    ...data,
  });
  if (level === "ERROR") logger.error(line);
  else if (level === "WARN") logger.warn(line);
  else logger.log(line);
}

function extractCustomerId(obj: { customer: string | Stripe.Customer | Stripe.DeletedCustomer | null }): string | null {
  if (typeof obj.customer === "string") return obj.customer;
  return obj.customer?.id ?? null;
}

async function firmByCustomer(customerId: string) {
  return prisma.firmProfile.findFirst({ where: { stripeCustomerId: customerId } });
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const sig     = req.headers.get("stripe-signature") ?? "";
  const secret  = process.env.STRIPE_WEBHOOK_SECRET ?? "";

  if (!secret) {
    log("ERROR", "missing_webhook_secret");
    return new NextResponse("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, secret);
  } catch (err) {
    log("ERROR", "signature_verification_failed", { error: String(err) });
    return new NextResponse("Webhook signature verification failed", { status: 400 });
  }

  log("INFO", "webhook_received", { type: event.type, id: event.id });

  try {
    await prisma.webhookEvent.create({
      data: { id: event.id, provider: "stripe", type: event.type },
    });
  } catch {
    log("WARN", "webhook_replay_ignored", { type: event.type, id: event.id });
    return NextResponse.json({ ok: true, replay: true });
  }

  // ── checkout.session.completed ─────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId  = session.metadata?.userId;
    const type    = session.metadata?.type;

    log("INFO", "checkout_session_completed", { sessionId: session.id, userId, type, amountTotal: session.amount_total });

    if (!userId) {
      log("WARN", "checkout_missing_userId", { sessionId: session.id });
      return NextResponse.json({ ok: true });
    }

    // V3: lead_claim — per-claim Stripe Checkout ($150). Complete the claim.
    if (type === "lead_claim") {
      const leadId = session.metadata?.leadId;
      if (!leadId) {
        log("WARN", "lead_claim_missing_leadId", { sessionId: session.id });
        return NextResponse.json({ ok: true });
      }

      const payment = await prisma.leadClaimPayment.findUnique({
        where: { stripeSessionId: session.id },
      });
      if (!payment) {
        log("WARN", "lead_claim_payment_not_found", { sessionId: session.id, leadId });
        return NextResponse.json({ ok: true });
      }

      await prisma.leadClaimPayment.update({
        where: { id: payment.id },
        data: { status: "completed", completedAt: new Date() },
      });

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        log("WARN", "lead_claim_lead_not_found", { leadId });
        return NextResponse.json({ ok: true });
      }

      const preApproved = lead.applicantStatus === "approved";

      // Atomic guard: only claim if not already claimed (prevents TOCTOU race)
      const { count } = await prisma.lead.updateMany({
        where: { id: leadId, claimedByUserId: null },
        data: {
          claimedByUserId: userId,
          claimedAt: new Date(),
          status: "claimed",
          applicantStatus: preApproved ? "approved" : "pending_approval",
        },
      });

      if (count === 0) {
        log("WARN", "lead_already_claimed_refunding", { userId, leadId });
        // Lead was claimed between checkout start and payment completion — refund
        try {
          const paymentIntent = session.payment_intent;
          const piId = typeof paymentIntent === "string" ? paymentIntent : paymentIntent?.id;
          if (piId) {
            await stripe.refunds.create({ payment_intent: piId });
            await prisma.leadClaimPayment.update({
              where: { id: payment.id },
              data: { status: "refunded" },
            });
            log("INFO", "lead_claim_auto_refunded", { userId, leadId, paymentIntent: piId });
          }
        } catch (refundErr) {
          log("ERROR", "lead_claim_refund_failed", { userId, leadId, error: String(refundErr) });
        }
        return NextResponse.json({ ok: true });
      }

      log("INFO", "lead_claimed_via_payment", { userId, leadId, preApproved });

      if (preApproved) {
        autoConvertLead(leadId).catch((e) =>
          logger.error("[auto-convert] failed:", e)
        );
      } else {
        const firm = await prisma.firmProfile.findUnique({ where: { userId } });
        const claimingUser = await prisma.user.findUnique({ where: { id: userId } });

        const { plaintext: respondToken } = await issueToken({
          kind: "lead_consent",
          subjectType: "lead",
          subjectId: leadId,
          ttlMs: TTL.LEAD_CONSENT,
          createdById: userId,
        });

        sendLeadClaimConsent({
          to: lead.email,
          name: lead.name,
          attorneyName: claimingUser?.name ?? "An attorney",
          firmName: firm?.firmName,
          respondToken,
          calendlyUrl: firm?.calendlyUrl,
        }).catch(() => {});
      }

    // Legacy V2 credit purchases — no longer supported. Log and ignore.
    } else if (type === "case_purchase" || type === "credit_pack") {
      log("WARN", "legacy_credit_purchase_ignored", { sessionId: session.id, userId });
    } else if (type === "seat" || type === "case_mgmt_seat" || type === "subscription") {
      const customerId = extractCustomerId(session);
      const subscriptionId = typeof session.subscription === "string"
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id ?? null;

      const updateData: Record<string, unknown> = {};
      if (customerId) updateData.stripeCustomerId = customerId;
      if (subscriptionId) {
        updateData.stripeSubscriptionId = subscriptionId;
        updateData.subscriptionStatus = "active";
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.firmProfile.upsert({
          where:  { userId },
          update: updateData,
          create: { userId, ...updateData },
        });
      }

      log("INFO", "subscription_started", { userId, customerId, subscriptionId });
    } else {
      log("WARN", "checkout_unknown_type", { type, sessionId: session.id });
    }
  }

  // ── customer.subscription.updated ──────────────────────────────────────────
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = extractCustomerId(sub);

    log("INFO", "subscription_updated", { subscriptionId: sub.id, customerId, status: sub.status });

    if (!customerId) return NextResponse.json({ ok: true });
    const firm = await firmByCustomer(customerId);
    if (!firm) {
      log("WARN", "subscription_updated_firm_not_found", { customerId });
      return NextResponse.json({ ok: true });
    }

    await prisma.firmProfile.update({
      where: { id: firm.id },
      data: {
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
      },
    });

    log("INFO", "subscription_status_synced", { firmId: firm.id, status: sub.status });
  }

  // ── invoice.paid (seat monthly renewal) ────────────────────────────────────
  // Pricing-V3: the seat is access-only. Leads are paid per-claim via Checkout.
  // Just sync subscriptionStatus on each renewal.
  if (event.type === "invoice.paid") {
    const invoice    = event.data.object as Stripe.Invoice;
    const customerId = extractCustomerId(invoice);

    log("INFO", "seat_renewed", { invoiceId: invoice.id, customerId, amountPaid: invoice.amount_paid });

    if (!customerId) {
      log("WARN", "invoice_missing_customerId", { invoiceId: invoice.id });
      return NextResponse.json({ ok: true });
    }

    const firm = await firmByCustomer(customerId);
    if (firm && firm.subscriptionStatus !== "active") {
      await prisma.firmProfile.update({
        where: { id: firm.id },
        data:  { subscriptionStatus: "active" },
      });
    }
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────
  if (event.type === "invoice.payment_failed") {
    const invoice    = event.data.object as Stripe.Invoice;
    const customerId = extractCustomerId(invoice);

    log("WARN", "invoice_payment_failed", { invoiceId: invoice.id, customerId });

    if (customerId) {
      const firm = await firmByCustomer(customerId);
      if (firm) {
        await prisma.firmProfile.update({
          where: { id: firm.id },
          data: { subscriptionStatus: "past_due" },
        });
        log("INFO", "firm_marked_past_due", { firmId: firm.id });
      }
    }
  }

  // ── customer.subscription.deleted ─────────────────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const sub        = event.data.object as Stripe.Subscription;
    const customerId = extractCustomerId(sub);

    log("INFO", "subscription_deleted", { subscriptionId: sub.id, customerId });

    if (!customerId) return NextResponse.json({ ok: true });
    const firm = await firmByCustomer(customerId);
    if (!firm) {
      log("WARN", "subscription_deleted_firm_not_found", { customerId });
      return NextResponse.json({ ok: true });
    }

    await prisma.firmProfile.update({
      where: { id: firm.id },
      data: {
        networkTier: "standard",
        subscriptionStatus: "canceled",
        stripeSubscriptionId: null,
      },
    });

    log("INFO", "firm_downgraded", { firmId: firm.id, subscriptionId: sub.id });
  }

  // ── charge.refunded — ultimate refund-state reconciliation ─────────────────
  // A lead-claim refund can originate from four places: the admin approve route,
  // the ghost-refund cron, the claim-race auto-refund above, or a manual refund
  // in the Stripe dashboard. Each of those does Stripe-first, then sequential DB
  // writes (deliberately NOT wrapped around the Stripe call). If the process dies
  // between the Stripe refund and the DB writes, money is back but the lead still
  // reads "claimed". This handler is the self-healing backstop: whatever the
  // origin, it converges LeadClaimPayment + Lead to the refunded/returned state.
  // Idempotent (WebhookEvent de-dupes replays; the status guards no-op on the
  // common case where the initiating path already wrote the DB).
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const piId = typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

    if (!piId) {
      log("WARN", "charge_refunded_no_payment_intent", { chargeId: charge.id });
      return NextResponse.json({ ok: true });
    }

    // Map payment_intent → checkout session → LeadClaimPayment (we key payments
    // by stripeSessionId, not payment_intent, so resolve the session first).
    const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
    const sessionId = sessions.data[0]?.id;
    if (!sessionId) {
      log("INFO", "charge_refunded_no_session", { chargeId: charge.id, piId });
      return NextResponse.json({ ok: true });
    }

    const payment = await prisma.leadClaimPayment.findUnique({
      where: { stripeSessionId: sessionId },
    });
    if (!payment) {
      // Not a lead-claim charge (e.g. a subscription/seat refund) — nothing here.
      log("INFO", "charge_refunded_not_lead_claim", { sessionId });
      return NextResponse.json({ ok: true });
    }

    if (payment.status !== "refunded") {
      await prisma.leadClaimPayment.update({
        where: { id: payment.id },
        data: { status: "refunded" },
      });
      log("INFO", "charge_refunded_payment_reconciled", { paymentId: payment.id, leadId: payment.leadId });
    }

    // Return the lead to the marketplace if it's still claimed by this payer.
    const lead = await prisma.lead.findUnique({ where: { id: payment.leadId } });
    if (lead && lead.claimedByUserId === payment.userId && lead.status === "claimed") {
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
      log("INFO", "charge_refunded_lead_returned", { leadId: lead.id });
    }
  }

  return NextResponse.json({ ok: true });
}
