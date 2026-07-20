import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackFunnel } from "@/lib/funnel";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["delivered", "consult_booked", "signed", "rejected_junk"] as const;
type OutcomeStatus = typeof VALID_STATUSES[number];

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { outcomeId: string; status: OutcomeStatus; reason?: string; revenueCents?: number };
  const { outcomeId, status, reason, revenueCents } = body;

  if (!outcomeId) return NextResponse.json({ error: "outcomeId required" }, { status: 400 });
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const existing = await prisma.leadOutcome.findFirst({ where: { id: outcomeId, leadId: id } });
  if (!existing) return NextResponse.json({ error: "Outcome not found for this lead" }, { status: 404 });

  const updated = await prisma.leadOutcome.update({
    where: { id: outcomeId },
    data: {
      status,
      ...(reason !== undefined ? { reason } : {}),
      ...(revenueCents !== undefined ? { revenueCents } : {}),
    },
  });

  trackFunnel({ event: "pilot.outcome_updated", leadId: id, props: { status, outcomeId } });

  return NextResponse.json({ ok: true, outcome: updated });
}

export const POST = withRoute(_POST);
