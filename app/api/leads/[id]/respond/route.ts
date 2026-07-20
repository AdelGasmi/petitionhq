/**
 * POST /api/leads/[id]/respond
 *
 * Public endpoint — authenticated by lead_consent token (emailed to applicant).
 * Applicant approves or rejects an attorney's claim on their lead.
 *
 * Body: { token: string, action: "approve" | "reject", note?: string }
 */
import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { prisma } from "@/lib/prisma";
import { verifyToken, consumeToken } from "@/lib/tokens";
import { sendClaimRejectedNotice } from "@/lib/email";
import { autoConvertLead } from "@/lib/lead-convert";
import { trackFunnel } from "@/lib/funnel";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    token: string;
    action: "approve" | "reject";
    note?: string;
  } | null;

  if (!body?.token || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const verified = await verifyToken(body.token, "lead_consent");
  if (!verified || verified.subjectId !== id) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { claimedBy: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lead.applicantStatus !== "pending_approval") {
    return NextResponse.json(
      { error: "This claim has already been responded to" },
      { status: 409 }
    );
  }

  await consumeToken(verified.id);

  if (body.action === "approve") {
    await prisma.lead.update({
      where: { id },
      data: { applicantStatus: "approved" },
    });

    trackFunnel({ event: "lead.applicant_approved", leadId: id });

    autoConvertLead(id).catch((e) =>
      logger.error("[auto-convert] failed:", e)
    );

    return NextResponse.json({ ok: true, action: "approved" });
  }

  const attorney = lead.claimedBy;

  await prisma.lead.update({
    where: { id },
    data: {
      applicantStatus: "rejected",
      rejectionNote:   body.note ?? null,
      claimedByUserId: null,
      status:          "new",
    },
  });

  trackFunnel({ event: "lead.applicant_rejected", leadId: id });

  if (attorney?.email) {
    sendClaimRejectedNotice({
      to:            attorney.email,
      attorneyName:  attorney.name,
      applicantName: lead.name,
      note:          body.note,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, action: "rejected" });
}

export const POST = withRoute(_POST);
