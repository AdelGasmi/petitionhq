import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyLead } from "@/lib/verification/orchestrator";
import { trackFunnel } from "@/lib/funnel";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/leads/[id]/verify — trigger full verification after consent.
 *
 * Called from the funnel when applicant opts in. Requires the resultToken
 * capability token (sent to the applicant in their confirmation email).
 * Fans out to 10+ external APIs, so unauthorized calls would be expensive.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const body = await req.json().catch(() => ({})) as { resultToken?: string };
  const { resultToken } = body;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, resultToken: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  if (!resultToken || lead.resultToken == null || lead.resultToken !== resultToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  trackFunnel({ event: "verification.deep_started", leadId: id });

  try {
    const result = await verifyLead(id, { reason: "intake_complete" });

    trackFunnel({
      event: "verification.deep_completed",
      leadId: id,
      props: { trustScore: result.trustScore, claimCount: Object.keys(result.verifiedClaims).length },
    });

    return NextResponse.json({
      ok: true,
      trustScore: result.trustScore,
      verifiedClaims: result.verifiedClaims,
      newMaturity: result.newMaturity,
    });
  } catch (e) {
    logger.error("[verify] Failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 500 },
    );
  }
}
