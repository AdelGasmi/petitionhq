import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { prisma } from "@/lib/prisma";
import { tierFor, canonicalToLegacyTier, clampScoreToEvidence, scoreFromDimensions } from "@/lib/scoring";
import { nextMaturity } from "@/lib/leadMaturity";
import type { LeadMaturity } from "@/lib/leadMaturity";
import { verifyLead } from "@/lib/verification/orchestrator";
import { sendLeadConfirmation } from "@/lib/email";
import logger from "@/lib/logger";

// Deep-intake fields. Their presence in the reassess payload marks the
// transition from the preliminary (median-assumption) pass to the real,
// complete read — which is when we send the authoritative confirmation email.
// Decline and light-only re-checks carry none of these and must NOT re-email.
const DEEP_EVIDENCE_KEYS = [
  "nationalConnection", "usPlan", "employerSituation",
  "peerReview", "invitedTalks", "patents", "awards", "grants",
] as const;

function hasDeepEvidence(fd: Record<string, unknown> | undefined): boolean {
  if (!fd) return false;
  return DEEP_EVIDENCE_KEYS.some((k) => typeof fd[k] === "string" && (fd[k] as string).trim() !== "");
}

/** Stored `_gapNarrative` holds the CheckResult shape (string arrays); the email
 *  wants joined strings. Mirrors the join the client does at the gate. */
function gapNarrativeToEmail(
  gn: unknown,
): { strengths?: string; blockers?: string; legalLeverage?: string } | undefined {
  if (!gn || typeof gn !== "object") return undefined;
  const g = gn as Record<string, unknown>;
  const join = (v: unknown) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").join(" ") : typeof v === "string" ? v : undefined;
  return { strengths: join(g.strengths), blockers: join(g.blockers), legalLeverage: join(g.legalLeverage) };
}

function classifyTier(score: number | undefined): string {
  if (!score) return "tier3";
  return canonicalToLegacyTier(tierFor(score));
}

// Keys accepted from client-supplied formData. Mirrors CheckAnswers plus name
// fields merged by /api/leads and internal computed fields from the assessment.
// Unknown keys are silently dropped to prevent stored prompt injection.
const ALLOWED_FORM_KEYS = new Set([
  "degree", "field", "institution", "institutionRorId", "yearsExperience",
  "publications", "citations", "role", "patents", "awards", "grants",
  "peerReview", "invitedTalks", "nationalConnection", "usPlan", "employerSituation",
  "orcid", "firstName", "lastName",
  "_gapNarrative", "_dimensions", "_summary",
]);

const MAX_STRING_LEN = 1_000;

function sanitizeFormData(raw: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (!ALLOWED_FORM_KEYS.has(key)) continue;
    if (typeof val === "string") {
      safe[key] = val.length > MAX_STRING_LEN ? val.slice(0, MAX_STRING_LEN) : val;
    } else {
      safe[key] = val;
    }
  }
  return safe;
}

// Reassessment is a score recalc, not a new lead — so we never fire the admin
// alert here. The applicant confirmation fires EXACTLY ONCE more, and only on
// the deep-intake transition (when real deep evidence arrives and the read
// supersedes the preliminary gate email). Decline and light-only re-checks
// carry no deep evidence and re-send nothing, so inboxes aren't flooded.
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as {
    resultToken?: string;
    tier?: string;
    score?: number;
    formData?: Record<string, unknown>;
  };

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, score: true, maturity: true, resultToken: true },
  });
  if (!lead) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { resultToken } = body;
  if (!resultToken || lead.resultToken == null || lead.resultToken !== resultToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeFormData = body.formData ? sanitizeFormData(body.formData) : undefined;

  // R-3: re-derive the score server-side from the (sanitized) dimensions rather
  // than trusting the client-supplied body.score. In the normal flow this yields
  // the same number the client computed (same weights), but it removes the
  // ability to persist a score decoupled from the dimensions. Falls back to
  // body.score when dimensions aren't present.
  const recomputed = scoreFromDimensions(
    safeFormData?._dimensions as { score: number }[] | undefined,
  );
  const baseScore = recomputed ?? body.score;

  // Same evidence-ceiling clamp as the initial /api/leads write — the deep
  // reassess must not let a richer answer set push the score past what the
  // hard evidence supports. body.formData carries the check answers.
  const clampedScore = clampScoreToEvidence(baseScore, safeFormData) ?? undefined;
  const tier = classifyTier(clampedScore ?? lead.score ?? undefined);
  const newMaturity = nextMaturity(lead.maturity as LeadMaturity, "deep_wizard_complete");

  await prisma.lead.update({
    where: { id },
    data: {
      tier,
      ...(clampedScore != null ? { score: clampedScore } : {}),
      ...(safeFormData ? { formData: safeFormData as object } : {}),
      ...(newMaturity ? { maturity: newMaturity } : {}),
      updatedAt: new Date(),
    },
  });

  // Authoritative confirmation email — sent once, when the deep assessment
  // lands, carrying the SAME dimensions the result page renders. This is what
  // reconciles the inbox with the page: the gate email was the provisional
  // (median-assumption) preliminary read; this is the real one. Guarded to the
  // deep-evidence transition so decline/light re-checks don't re-email.
  const finalDims = safeFormData?._dimensions as { label: string; score: number; notes?: string }[] | undefined;
  if (lead.email && hasDeepEvidence(safeFormData) && Array.isArray(finalDims) && finalDims.length > 0) {
    sendLeadConfirmation({
      to: lead.email,
      name: lead.name,
      tier,
      resultToken,
      dimensions: finalDims,
      gapNarrative: gapNarrativeToEmail(safeFormData?._gapNarrative),
      summary: typeof safeFormData?._summary === "string" ? safeFormData._summary : undefined,
      isPreliminary: false,
    }).catch((e) => logger.error("[reassess] final confirmation failed:", e));
  }

  // Auto-trigger full verification the moment deep-intake data lands — no
  // longer gated behind the applicant clicking "Request Attorney Match".
  // This computes trustScore + verifiedClaims for every completed assessment
  // so the admin pipeline shows trust levels without anyone consenting first.
  // Fire-and-forget (capped at 12s) so the wizard response isn't blocked; M7
  // promotion still requires consent, which the consent-time verify re-checks.
  const verifyTimeout = new Promise<void>((resolve) => setTimeout(resolve, 12_000));
  Promise.race([
    verifyLead(id, { reason: "intake_complete" }).then(() => {}),
    verifyTimeout,
  ]).catch((e) => logger.error("[reassess] auto-verify failed:", e));

  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
