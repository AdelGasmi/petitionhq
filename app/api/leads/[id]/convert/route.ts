import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { prisma } from "@/lib/prisma";
import { createIntakeToken } from "@/lib/db";
import { autoConvertLead } from "@/lib/lead-convert";

export const dynamic = "force-dynamic";

/**
 * POST /api/leads/[id]/convert
 *
 * Called from the result page when the applicant clicks the CTA.
 * Delegates entirely to autoConvertLead — which enforces that a case is only
 * created once an attorney has claimed the lead (TD-1 + TD-2).
 *
 * Requires resultToken in body — the capability token sent to the applicant
 * in their confirmation email.
 *
 * If no attorney has claimed yet: returns { ok: true, pending: true }.
 * If already converted:           returns { ok: true, caseId, intakeToken }.
 * If newly converted:             returns { ok: true, caseId, intakeToken }.
 *
 * NOTE: This endpoint is a bridge until Phase B replaces the result-page CTA
 * with an upstream consent checkbox. At that point this route can be deleted.
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { resultToken?: string };
  const { resultToken } = body;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, caseId: true, claimedByUserId: true, email: true, resultToken: true },
  });

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  if (!resultToken || lead.resultToken == null || lead.resultToken !== resultToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No attorney has claimed yet — applicant is approved and waiting in the pool
  if (!lead.claimedByUserId) {
    return NextResponse.json({ ok: true, pending: true });
  }

  // Already converted — re-issue an intake token so the applicant can re-enter
  if (lead.caseId) {
    const { token: intakeToken } = await createIntakeToken(lead.caseId, lead.email);
    return NextResponse.json({ ok: true, caseId: lead.caseId, intakeToken });
  }

  // Attorney has claimed but case not yet created — run the unified converter
  const result = await autoConvertLead(id);
  if (!result) {
    return NextResponse.json({ ok: true, pending: true });
  }

  return NextResponse.json({ ok: true, caseId: result.caseId, intakeToken: result.intakeToken });
}

export const POST = withRoute(_POST);
