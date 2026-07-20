import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { trackFunnel } from "@/lib/funnel";

export const dynamic = "force-dynamic";

async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json() as { pilotFirm: string };
  const pilotFirm = (body.pilotFirm ?? "").trim();
  if (!pilotFirm) return NextResponse.json({ error: "pilotFirm required" }, { status: 400 });

  const lead = await prisma.lead.findUnique({ where: { id }, select: { id: true, applicantStatus: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (lead.applicantStatus !== "approved") {
    return NextResponse.json({ error: "Lead must be consented (applicantStatus=approved)" }, { status: 400 });
  }

  const outcome = await prisma.leadOutcome.create({
    data: { leadId: id, pilotFirm, status: "delivered" },
  });

  trackFunnel({ event: "pilot.lead_delivered", leadId: id, props: { pilotFirm } });

  return NextResponse.json({ ok: true, outcome });
}

export const POST = withRoute(_POST);
