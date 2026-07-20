import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDossier } from "@/lib/dossierGenerator";
import { generateBriefDocx } from "@/lib/briefDocx";
import { logActivity } from "@/lib/activity";
import { resolveCandidateScore } from "@/lib/scoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * GET /api/leads/[id]/brief — returns the petition brief as an editable .docx
 * (Prong 1A/1B/3 + exhibit plan).
 *
 * Access: admin + the claiming attorney only. The brief is the full post-claim work
 * product (identity + analysis), so attorneys are BOLA-gated to leads they own,
 * mirroring the dossier endpoint. No preview-token path — never exposed to
 * anonymous/cold-email viewers.
 *
 * Provenance gate (GAP-4): the brief is the *filing* work product, so unlike the
 * dossier PDF (a labeled "preliminary assessment" that stays non-blocking) it is
 * HARD-FAILED when the provenance linter flags numeric claims lacking a
 * verified-source citation or a [self-reported] tag. The attorney may override
 * with `?ack=1`; the override is written to the ActivityLog as a
 * malpractice-defense trail. The linter stays a pure detector — the policy
 * (block on any flagged claim, regardless of severity) lives here.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getSession();

  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (session.role !== "admin" && session.role !== "attorney") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: {
      id: true,
      tier: true,
      score: true,
      formData: true,
      caseId: true,
      verifiedClaims: true,
      claimedByUserId: true,
    },
  });
  if (!lead) {
    return new NextResponse("Not found", { status: 404 });
  }

  // BOLA gate: attorneys can only export briefs for leads they claimed.
  if (session.role !== "admin" && lead.claimedByUserId !== session.userId) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!lead.caseId) {
    return NextResponse.json(
      { error: "No brief available — this lead has not been converted to a case yet." },
      { status: 404 }
    );
  }

  const vc = lead.verifiedClaims as Record<
    string,
    { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }
  > | null;

  // Evidence-ceiling guard on the read path (mirrors the dossier route): the
  // filing .docx must never render a score the evidence doesn't support.
  const { score: candidateScore, tier: candidateTier } = resolveCandidateScore(
    lead.score,
    lead.formData as Record<string, unknown> | null,
    lead.tier ?? "tier3",
  );

  const data = await generateDossier(lead.caseId, candidateTier, candidateScore, lead.id, vc);

  // GAP-4 export gate. Block the filing .docx when the provenance linter flagged
  // any numeric claim that lacks a verified-source citation or [self-reported]
  // tag. The attorney can override with ?ack=1 — that path is audit-logged.
  const lintIssues = data.provenanceLint.issues;
  const ack = req.nextUrl.searchParams.get("ack") === "1";

  if (lintIssues.length > 0 && !ack) {
    return NextResponse.json(
      {
        error: "unverified_claims",
        message:
          `This brief contains ${lintIssues.length} numeric claim(s) that lack a ` +
          `verified-source citation or a [self-reported] tag. Review them, then ` +
          `re-export with ?ack=1 to acknowledge and proceed.`,
        issues: lintIssues,
        stats: data.provenanceLint.stats,
      },
      { status: 422 },
    );
  }

  if (lintIssues.length > 0 && ack) {
    // Override path — record who exported a brief over flagged claims, and what
    // those claims were, so the firm has a defensible trail.
    const sections = [...new Set(lintIssues.map((i) => i.section))];
    await logActivity({
      actor: session,
      caseId: lead.caseId,
      caseTitle: data.applicantName,
      action: "brief.exported_with_unverified_claims",
      detail:
        `Override (ack=1): exported brief despite ${lintIssues.length} untagged numeric ` +
        `claim(s) across ${sections.join(", ")} ` +
        `(${data.provenanceLint.stats.untagged}/${data.provenanceLint.stats.totalClaims} metric claims untagged).`,
    });
  }

  const docxBuffer = await generateBriefDocx(data);

  return new NextResponse(docxBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": DOCX_MIME,
      "Content-Disposition": `attachment; filename="petition-brief-${lead.id.slice(0, 8)}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
