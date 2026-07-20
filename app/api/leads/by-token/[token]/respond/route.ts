/**
 * POST /api/leads/by-token/[token]/respond
 *
 * Lookup lead by lead_consent token, then process approve/reject.
 * This lets the frontend call a single URL without knowing the lead ID.
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, consumeToken } from "@/lib/tokens";
import { sendClaimRejectedNotice } from "@/lib/email";
import { autoConvertLead } from "@/lib/lead-convert";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  let body: { action: "approve" | "reject"; note?: string };
  try {
    body = await parseJsonBody(req, 4_096);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body || !["approve", "reject"].includes(body.action)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const verified = await verifyToken(token, "lead_consent");
  if (!verified) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: verified.subjectId },
    include: { claimedBy: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (lead.applicantStatus !== "pending_approval") {
    return NextResponse.json({ error: "Already responded" }, { status: 409 });
  }

  await consumeToken(verified.id);

  if (body.action === "approve") {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { applicantStatus: "approved" },
    });
    autoConvertLead(lead.id).catch((e) =>
      logger.error("[auto-convert/by-token] failed:", e)
    );
    return NextResponse.json({ ok: true, action: "approved" });
  }

  const attorney = lead.claimedBy;
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      applicantStatus: "rejected",
      rejectionNote:   body.note ?? null,
      claimedByUserId: null,
      status:          "new",
    },
  });

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
