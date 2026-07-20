import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/tokens";
import { generateDossier } from "@/lib/dossierGenerator";
import { renderDossierPdf, renderLeadSummaryPdf } from "@/lib/dossierPdf";
import { storageGet, storageExists } from "@/lib/storage";
import { dossierFilename } from "@/lib/fileNames";
import { resolveCandidateScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();
  const rawPreviewToken = req.nextUrl.searchParams.get("token");

  // S-14: validate the preview token against the Token table — never trust a bare
  // query-param value. verifyToken hashes the input and checks kind/expiry/consumed.
  let previewGranted = false;
  if (!session && rawPreviewToken) {
    const verified = await verifyToken(rawPreviewToken, "lead_preview");
    if (verified && verified.subjectId === id) {
      previewGranted = true;
    }
  }

  if (!session && !previewGranted) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session && session.role !== "admin" && session.role !== "attorney") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true, name: true, tier: true, score: true, capturedAt: true,
      caseId: true, dossierPdfPath: true, formData: true,
      verifiedClaims: true, trustScore: true,
      claimedByUserId: true,
    },
  });
  if (!lead) return new NextResponse("Not found", { status: 404 });

  // BOLA gate: attorneys can only download dossiers for leads they claimed.
  // Preview-token path (unauthenticated email links) skips this — the token
  // itself is scoped to the lead by subjectId check above.
  if (session && session.role !== "admin" && lead.claimedByUserId !== session.userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Evidence-ceiling guard on the read path too: clamp the score/tier this PDF
  // renders so a legacy lead scored before the ceiling existed can never print
  // an unsupported score. Derived once, used for the filename and both render
  // branches below. See lib/scoring.ts → resolveCandidateScore.
  const { score: candidateScore, tier: candidateTier } = resolveCandidateScore(
    lead.score,
    lead.formData as Record<string, unknown> | null,
    lead.tier ?? "tier3",
  );

  const filename = dossierFilename(lead.name, candidateTier, lead.capturedAt);

  // Serve cached PDF if already generated
  if (lead.dossierPdfPath && await storageExists(lead.dossierPdfPath)) {
    const pdf = await storageGet(lead.dossierPdfPath, "secure");
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // Generate full dossier on-demand if case exists
  if (lead.caseId) {
    const vc = lead.verifiedClaims as Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }> | null;
    const data = await generateDossier(lead.caseId, candidateTier, candidateScore, lead.id, vc);
    const pdfBuffer = await renderDossierPdf(data, {
      trustScore: lead.trustScore,
      verifiedClaims: vc,
    });

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  // No case yet — render lead summary PDF from check questionnaire data
  const fd = lead.formData as Record<string, unknown> | null;
  if (!fd) {
    return new NextResponse("No data available for this lead", { status: 404 });
  }

  const field = String(fd.field ?? "Research");
  const vc = lead.verifiedClaims as Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }> | null;
  const pdfBuffer = await renderLeadSummaryPdf({
    field,
    tier: candidateTier,
    score: candidateScore,
    capturedAt: lead.capturedAt,
    formData: fd,
    trustScore: lead.trustScore,
    verifiedClaims: vc,
  });

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
