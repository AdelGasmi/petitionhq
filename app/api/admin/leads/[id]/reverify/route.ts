import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { verifyLead } from "@/lib/verification/orchestrator";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/leads/[id]/reverify — trigger manual re-verification.
 *
 * Admin-only. Runs the full verification orchestrator with reason "manual".
 * Returns the updated trust score and verified claims.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const result = await verifyLead(id, { reason: "manual" });

    logger.info(`[reverify] Lead ${id}: trustScore=${result.trustScore}, maturity=${result.newMaturity}`);

    return NextResponse.json({
      ok: true,
      trustScore: result.trustScore,
      verifiedClaims: result.verifiedClaims,
      newMaturity: result.newMaturity,
      eventCount: result.eventCount,
      scoringBreakdown: result.scoringBreakdown,
    });
  } catch (e) {
    logger.error("[reverify] Failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Verification failed" },
      { status: 500 },
    );
  }
}
