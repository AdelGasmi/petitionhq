import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderVerificationReportPdf } from "@/lib/verificationReportPdf";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/leads/[id]/verification-report — returns the verification report PDF.
 *
 * Access: admin + the claiming attorney only. The report exposes trust score and
 * per-claim provenance, which is post-claim information — so attorneys are BOLA-gated
 * to leads they own (S-16), mirroring the dossier endpoint. No preview-token path:
 * verification provenance is never exposed to anonymous/cold-email viewers.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const session = await getSession();

  if (!session || (session.role !== "admin" && session.role !== "attorney")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      trustScore: true,
      verifiedClaims: true,
      lastVerifiedAt: true,
      claimedByUserId: true,
    },
  });

  if (!lead) {
    return new NextResponse("Not found", { status: 404 });
  }

  // BOLA gate (S-16): attorneys can only pull verification reports for leads they
  // claimed. Admins are exempt. session is non-null here (checked above).
  if (session.role !== "admin" && lead.claimedByUserId !== session.userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const vc = lead.verifiedClaims as Record<string, {
    status: string;
    source: string;
    sourceUrl?: string;
    confidence: number;
    detail?: string;
  }> | null;

  if (!vc || Object.keys(vc).length === 0) {
    return NextResponse.json(
      { error: "No verification data available for this lead" },
      { status: 404 },
    );
  }

  const pdfBuffer = await renderVerificationReportPdf({
    leadId: lead.id,
    trustScore: lead.trustScore,
    verifiedClaims: vc,
    generatedAt: lead.lastVerifiedAt ?? new Date(),
  });

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="verification-report-${lead.id.slice(0, 8)}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
