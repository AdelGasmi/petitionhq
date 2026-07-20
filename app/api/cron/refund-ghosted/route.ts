import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import { sendGhostRefundEmail, sendLeadReturnedEmail } from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const GHOST_DAYS = 14;

/**
 * POST /api/cron/refund-ghosted
 * Daily cron. Finds leads claimed 14+ days ago where the applicant hasn't
 * completed intake, and auto-refunds the attorney.
 *
 * Idempotent: skips leads with existing "applicant_ghost" refund requests.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GHOST_DAYS * 24 * 60 * 60 * 1000);

  // Find leads that:
  // 1. Were claimed before the cutoff (14+ days ago)
  // 2. Applicant hasn't responded (still pending_approval)
  // 3. Have a completed payment (real money at stake)
  // 4. Haven't already been ghost-refunded
  const ghostedLeads = await prisma.lead.findMany({
    where: {
      claimedAt: { lt: cutoff, not: null },
      applicantStatus: "pending_approval",
      status: "claimed",
      claimPayment: { status: "completed" },
    },
    select: {
      id: true,
      email: true,
      name: true,
      caseId: true,
      claimedByUserId: true,
      claimPayment: {
        select: {
          id: true,
          stripeSessionId: true,
          amountCents: true,
          userId: true,
        },
      },
    },
  });

  let refunded = 0;
  let skipped = 0;
  let failed = 0;

  for (const lead of ghostedLeads) {
    const payment = lead.claimPayment;
    if (!payment || !lead.claimedByUserId || !lead.caseId) {
      skipped++;
      continue;
    }

    // Idempotency: skip if ANY active or settled refund already exists for this
    // case — not just ghost refunds. This prevents a second Stripe refund when an
    // attorney has already filed a (still-pending) misrepresentation request on
    // the same case. ("approved" is intentionally omitted — no code path sets it;
    // the admin route transitions pending → refunded | denied directly.)
    const existingRefund = await prisma.refundRequest.findFirst({
      where: {
        caseId: lead.caseId,
        status: { in: ["pending", "refunded"] },
      },
    });
    if (existingRefund) {
      skipped++;
      continue;
    }

    // Attempt Stripe refund
    let stripeRefundId: string | null = null;
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(payment.stripeSessionId);
      const paymentIntentId = typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id;

      if (!paymentIntentId) {
        logger.warn(`[ghost-refund] No payment_intent for session ${payment.stripeSessionId}, lead ${lead.id}`);
        failed++;
        continue;
      }

      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
      });
      stripeRefundId = refund.id;
    } catch (err) {
      logger.error(`[ghost-refund] Stripe refund failed for lead ${lead.id}:`, err);
      failed++;
      continue;
    }

    // Create RefundRequest record for audit
    await prisma.refundRequest.create({
      data: {
        caseId: lead.caseId,
        attorneyId: lead.claimedByUserId,
        reason: "applicant_ghost",
        explanation: `Automatic: applicant did not complete intake within ${GHOST_DAYS} days.`,
        status: "refunded",
        decidedAt: new Date(),
        stripeRefundId,
      },
    });

    // Reset lead to marketplace
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
      caseId: lead.caseId,
      action: "refund.approved",
      detail: `Auto ghost-refund after ${GHOST_DAYS} days. Stripe: ${stripeRefundId}`,
    });

    // Email attorney
    const attorney = await prisma.user.findUnique({
      where: { id: lead.claimedByUserId },
      select: { email: true, name: true },
    });

    if (attorney) {
      sendGhostRefundEmail({
        to: attorney.email,
        attorneyName: attorney.name ?? "Attorney",
        caseId: lead.caseId,
        amountCents: payment.amountCents,
      }).catch(() => {});
    }

    // Email applicant
    sendLeadReturnedEmail({
      to: lead.email,
      applicantName: lead.name ?? undefined,
    }).catch(() => {});

    refunded++;
    logger.log(`[ghost-refund] Refunded lead ${lead.id}, stripe ${stripeRefundId}`);
  }

  logger.log(`[ghost-refund] Complete: ${refunded} refunded, ${skipped} skipped, ${failed} failed`);

  return NextResponse.json({
    ok: true,
    processed: ghostedLeads.length,
    refunded,
    skipped,
    failed,
  });
}
