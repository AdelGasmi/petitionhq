import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const ATTEST_TRUST_FLOOR = 65; // clears the 60-point M7 gate with a small buffer

/**
 * POST /api/admin/leads/[id]/attest — admin identity attestation.
 *
 * For pilots whose automated trust score stays below 60 despite verifiable
 * credentials (thin ORCID profile, name collision, missing DOI index, etc.).
 * Admin provides a written reason, which is stored for audit purposes.
 *
 * Effects:
 *   - adminAttested = true, adminAttestedBy = session email, adminAttestedReason = reason
 *   - trustScore raised to max(current, ATTEST_TRUST_FLOOR)
 *   - maturity advanced to M7 if currently M3 or M4 (requires deep intake to be complete)
 *   - LeadVerificationEvent written for the audit trail
 */
export async function POST(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const reason = (body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json({ error: "A written reason is required for attestation" }, { status: 422 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, email: true, maturity: true, trustScore: true, adminAttested: true },
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const newTrustScore = Math.max(lead.trustScore, ATTEST_TRUST_FLOOR);
  // Only advance maturity for leads that have completed deep intake (M3 or M4).
  // M1/M2 leads haven't submitted enough data for an attestation to be meaningful.
  const canAdvance = lead.maturity === "M3" || lead.maturity === "M4";
  const newMaturity = canAdvance ? "M7" : lead.maturity;

  try {
    await prisma.$transaction([
      prisma.lead.update({
        where: { id },
        data: {
          adminAttested: true,
          adminAttestedBy: session.email ?? session.userId,
          adminAttestedAt: new Date(),
          adminAttestedReason: reason,
          trustScore: newTrustScore,
          maturity: newMaturity as never,
        },
      }),
      prisma.leadVerificationEvent.create({
        data: {
          leadId: id,
          source: "admin_attestation",
          action: "identity_attested",
          result: "verified",
          claimKey: "identity",
          evidenceRef: null,
          confidenceScore: 1.0,
          attorneyVisible: false,
        },
      }),
    ]);
  } catch (e) {
    logger.error("[attest] Failed:", e);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }

  logger.info(`[attest] Lead ${id}: attested by ${session.email}, score ${lead.trustScore}→${newTrustScore}, maturity ${lead.maturity}→${newMaturity}`);

  logActivity({
    actor: session,
    action: "lead.attested",
    detail: `${id} (${lead.email}) — reason: ${reason.slice(0, 120)}`,
  });

  return NextResponse.json({
    ok: true,
    trustScore: newTrustScore,
    maturity: newMaturity,
    adminAttested: true,
  });
}
