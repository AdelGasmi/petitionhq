import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/leads/[id] — permanently remove a lead.
 *
 * For clearing test/spam/duplicate leads from the pipeline. Guarded: a lead
 * that has been claimed by a firm or promoted to a real Case is NOT deletable
 * here (would orphan attorney-client work) — release it first.
 *
 * FK cleanup: LeadVerificationEvent / LeadClaimPayment / LlmUsage have no
 * cascade, so we remove them in a transaction before deleting the lead.
 */
/**
 * PATCH /api/admin/leads/[id] — archive (disqualify) a lead without deleting it.
 */
export async function PATCH(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, claimedByUserId: true, caseId: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (lead.claimedByUserId || lead.caseId) {
    return NextResponse.json(
      { error: "Cannot archive a claimed lead — release it first." },
      { status: 409 },
    );
  }

  await prisma.lead.update({ where: { id }, data: { status: "disqualified" } });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, email: true, claimedByUserId: true, caseId: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (lead.claimedByUserId || lead.caseId) {
    return NextResponse.json(
      { error: "This lead is claimed or has an active case. Release it first, then delete." },
      { status: 409 },
    );
  }

  try {
    await prisma.$transaction([
      prisma.leadVerificationEvent.deleteMany({ where: { leadId: id } }),
      prisma.leadClaimPayment.deleteMany({ where: { leadId: id } }),
      prisma.llmUsage.deleteMany({ where: { leadId: id } }),
      prisma.lead.delete({ where: { id } }),
    ]);
  } catch (e) {
    logger.error("[lead-delete] failed:", e);
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 });
  }

  logActivity({
    actor: session,
    action: "lead.deleted",
    detail: `${id} (${lead.email})`,
  });

  return NextResponse.json({ ok: true, deleted: true });
}
