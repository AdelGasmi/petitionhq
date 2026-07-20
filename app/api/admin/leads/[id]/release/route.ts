import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { logActivity } from "@/lib/activity";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/leads/[id]/release — release a claimed lead back to the pool.
 *
 * Optionally issues a Stripe refund if there's a completed LeadClaimPayment.
 * Body: { refund?: boolean, reason?: string }
 *
 * Steps:
 *   1. Clear claim fields on Lead (claimedByUserId, claimedAt, status → "open")
 *   2. Delete the LeadClaimPayment record
 *   3. If refund=true and stripeSessionId exists, issue Stripe refund
 *   4. Log the action
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { refund?: boolean; reason?: string };
  try {
    body = await parseJsonBody(req, 2_048);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { claimPayment: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!lead.claimedByUserId) {
    return NextResponse.json({ error: "Lead is not claimed" }, { status: 400 });
  }

  let refundId: string | null = null;

  // Stripe refund if requested and payment exists
  if (body.refund && lead.claimPayment?.status === "completed" && lead.claimPayment.stripeSessionId) {
    try {
      // Retrieve the Stripe checkout session to get the payment intent
      const checkoutSession = await stripe.checkout.sessions.retrieve(lead.claimPayment.stripeSessionId);
      const paymentIntentId = typeof checkoutSession.payment_intent === "string"
        ? checkoutSession.payment_intent
        : checkoutSession.payment_intent?.id;

      if (paymentIntentId) {
        const refund = await stripe.refunds.create({
          payment_intent: paymentIntentId,
          reason: "requested_by_customer",
        });
        refundId = refund.id;
      }
    } catch (e) {
      logger.error("[lead-release] Stripe refund failed:", e);
      return NextResponse.json(
        { error: "Stripe refund failed. Release the lead without refund, or retry." },
        { status: 502 }
      );
    }
  }

  // Delete the payment record if it exists
  if (lead.claimPayment) {
    await prisma.leadClaimPayment.delete({
      where: { id: lead.claimPayment.id },
    });
  }

  // Reset lead to open state
  await prisma.lead.update({
    where: { id },
    data: {
      claimedByUserId: null,
      claimedAt: null,
      status: "open",
      applicantStatus: "unclaimed",
      caseId: null,
    },
  });

  logActivity({
    actor: session,
    action: "lead.released",
    detail: `${id}${body.refund ? " (refunded)" : ""}${body.reason ? ` — ${body.reason}` : ""}`,
  });

  return NextResponse.json({
    ok: true,
    refundId,
    released: true,
  });
}
