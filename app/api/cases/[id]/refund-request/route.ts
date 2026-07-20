import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { sendRefundRequestAdminAlert } from "@/lib/email";

export const dynamic = "force-dynamic";

const VALID_REASONS = ["material_misrepresentation", "applicant_ghost", "other"] as const;
const REFUND_WINDOW_DAYS = 30;

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/cases/[id]/refund-request
 * Attorney requests a refund for a claimed case.
 * 30-day window enforced from claim date.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id: caseId } = await params;
  const session = await getSession();

  if (!session || session.role !== "attorney") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pilot-tier claims are free — nothing to refund
  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
    select: { networkTier: true },
  });
  if (firm?.networkTier === "pilot") {
    return NextResponse.json(
      { error: "Pilot-tier claims are not refundable. Contact support to release a ghosted lead." },
      { status: 403 },
    );
  }

  // Load case + linked lead
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      attorneyId: true,
      title: true,
    },
  });

  if (!caseRecord) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  // Only the assigned attorney can request a refund
  if (caseRecord.attorneyId !== session.userId) {
    return NextResponse.json({ error: "Only the assigned attorney can request a refund" }, { status: 403 });
  }

  // Find the lead linked to this case
  const lead = await prisma.lead.findFirst({
    where: { caseId },
    select: { id: true, claimedAt: true, claimedByUserId: true },
  });

  if (!lead || !lead.claimedAt) {
    return NextResponse.json({ error: "No claim payment found for this case" }, { status: 400 });
  }

  // Check claim payment exists
  const payment = await prisma.leadClaimPayment.findFirst({
    where: { leadId: lead.id, userId: session.userId, status: "completed" },
    select: { id: true, stripeSessionId: true, amountCents: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "No completed payment found for this lead claim" }, { status: 400 });
  }

  // 30-day window enforcement
  const claimDate = new Date(lead.claimedAt);
  const windowEnd = new Date(claimDate.getTime() + REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  if (new Date() > windowEnd) {
    return NextResponse.json(
      { error: `Refund window has closed. Refunds must be requested within ${REFUND_WINDOW_DAYS} days of claiming.` },
      { status: 409 },
    );
  }

  // Check for existing pending refund request
  const existing = await prisma.refundRequest.findFirst({
    where: { caseId, attorneyId: session.userId, status: "pending" },
  });

  if (existing) {
    return NextResponse.json({ error: "A refund request is already pending for this case" }, { status: 409 });
  }

  // Parse body
  let body: { reason?: string; explanation?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reason = body.reason as (typeof VALID_REASONS)[number] | undefined;
  if (!reason || !VALID_REASONS.includes(reason)) {
    return NextResponse.json(
      { error: `Invalid reason. Must be one of: ${VALID_REASONS.join(", ")}` },
      { status: 400 },
    );
  }

  const explanation = body.explanation?.trim();
  if (!explanation || explanation.length < 10) {
    return NextResponse.json(
      { error: "Explanation must be at least 10 characters" },
      { status: 400 },
    );
  }

  // Create refund request
  const refundRequest = await prisma.refundRequest.create({
    data: {
      caseId,
      attorneyId: session.userId,
      reason,
      explanation,
    },
  });

  // Activity log
  logActivity({
    actor: session,
    caseId,
    caseTitle: caseRecord.title,
    action: "refund.requested",
    detail: `Reason: ${reason.replace(/_/g, " ")}`,
  });

  // Notify admin
  sendRefundRequestAdminAlert({
    caseId,
    attorneyName: session.name ?? "Unknown",
    reason,
    explanation,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    refundRequestId: refundRequest.id,
    status: "pending",
  });
}
