import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_OUTCOMES = ["scheduled", "retained", "passed"] as const;

// PATCH /api/leads/[id]/status — attorney logs call outcome
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { callOutcome?: string } | null;
  if (!body?.callOutcome || !VALID_OUTCOMES.includes(body.callOutcome as typeof VALID_OUTCOMES[number])) {
    return NextResponse.json({ error: "Invalid callOutcome" }, { status: 400 });
  }

  await prisma.lead.update({
    where: { id },
    data: { callOutcome: body.callOutcome },
  });

  return NextResponse.json({ ok: true });
}

// GET /api/leads/[id]/status — public polling endpoint for dossier status
async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      dossierStatus: true,
      tier: true,
      score: true,
      caseId: true,
      dossierPdfPath: true,
    },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    dossierStatus: lead.dossierStatus,
    tier: lead.tier,
    score: lead.score,
    caseId: lead.caseId,
    hasPdf: !!lead.dossierPdfPath,
  });
}

export const PATCH = withRoute(_PATCH);
export const GET = withRoute(_GET);
