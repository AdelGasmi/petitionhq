import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/leads/[id]/requeue-dossier
 *
 * Admin-only. Resets dossierStatus from "failed" → "pending" so the next
 * cron run picks it up again. No-ops if already pending or processing.
 */
async function _POST(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, dossierStatus: true, caseId: true },
  });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (lead.dossierStatus !== "failed") {
    return NextResponse.json(
      { error: `Cannot requeue — dossierStatus is "${lead.dossierStatus}", not "failed"` },
      { status: 409 }
    );
  }
  if (!lead.caseId) {
    return NextResponse.json(
      { error: "Cannot requeue — lead has no associated case (intake not started)" },
      { status: 409 }
    );
  }

  await prisma.lead.update({
    where: { id },
    data: { dossierStatus: "pending" },
  });

  logActivity({ actor: session, action: "lead.dossier_requeued", detail: id });

  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
