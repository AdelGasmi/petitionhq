/**
 * Canonical tier + score logic for PetitionHQ.
 *
 * Before this file, threshold logic was duplicated in:
 *   - app/check/page.tsx                       (Strong/Borderline/Weak  @ 65/40)
 *   - app/check/result/[leadId]/page.tsx       (tier1/tier2/tier3       @ 75/50)
 *   - app/admin/leads/page.tsx                 (tier1/tier2/tier3 labels @ 75/50)
 *   - components/LetterEditor.tsx              (letter quality          @ 85/70)
 *
 * Each had slightly different cutoffs and vocabulary. This file is the
 * single source of truth. UI MUST consume `tierFor()`, `TIER_META`,
 * `letterQualityFor()`. Legacy DB values (`tier1`/`tier2`/`tier3`) get
 * mapped at the data-access boundary via `legacyTierToCanonical()`.
 *
 * See DESIGN.md §6.
 */

/* ─── Candidate tier (eligibility / case strength) ─────────────────────── */

export type Tier = "strong" | "developing" | "early";

/** Numeric thresholds. The boundary at 75 was the public-facing label in
 * admin/leads ("Tier 1 — Strong (≥75)"). 50 was the bottom of "Developing". */
export const TIER_THRESHOLDS = {
  strong: 75,
  developing: 50,
} as const;

export function tierFor(score: number): Tier {
  if (score >= TIER_THRESHOLDS.strong) return "strong";
  if (score >= TIER_THRESHOLDS.developing) return "developing";
  return "early";
}

/**
 * Deterministic overall score from the 5 Dhanasar dimension scores. Weights are
 * fixed in dimension order: EB-2 Baseline 15%, Prong 1 Merit 25%, Prong 1
 * Importance 20%, Prong 2 25%, Prong 3 15%.
 *
 * This is the single source of truth for the case-strength number — used both
 * at compute time (`/api/check`) and on deep reassess, so the persisted score
 * is always re-derived server-side from the dimensions rather than trusted from
 * the client. Returns null when there aren't exactly 5 dimensions (caller falls
 * back to whatever score it already has).
 */
export const DIMENSION_WEIGHTS = [0.15, 0.25, 0.2, 0.25, 0.15] as const;

export function scoreFromDimensions(
  dimensions: { score: number }[] | null | undefined,
): number | null {
  if (!Array.isArray(dimensions) || dimensions.length !== DIMENSION_WEIGHTS.length) {
    return null;
  }
  return Math.round(
    dimensions.reduce((sum, d, i) => sum + (Number(d?.score) || 0) * DIMENSION_WEIGHTS[i], 0),
  );
}

export const TIER_META: Record<
  Tier,
  {
    /** Short label — for compact UI (badges, table rows) */
    label: string;
    /** Long label — for hero blocks and admin lists */
    longLabel: string;
    /** Maps to the status token family in the design system */
    statusToken: "success" | "warning" | "neutral";
    /** Icon name resolved by components/icons/ (TBD in Phase 1) */
    icon: "check-circle" | "arrow-right" | "arrow-up-right";
    /** One-line description used as default summary fallback */
    description: string;
    /** Score band shown instead of the raw integer (R-1 — the exact number
     * carries false precision; UI surfaces display the band). Must stay in
     * sync with TIER_THRESHOLDS (asserted in tests/scoring.test.ts). */
    range: string;
  }
> = {
  strong: {
    label: "Strong",
    longLabel: "Strong Candidate",
    statusToken: "success",
    icon: "check-circle",
    description: "Your credentials support a well-structured NIW petition.",
    range: "75–100",
  },
  developing: {
    label: "Developing",
    longLabel: "Developing Case",
    statusToken: "warning",
    icon: "arrow-right",
    description:
      "Your profile shows real promise. With targeted legal framing, your case could be significantly strengthened.",
    range: "50–74",
  },
  early: {
    label: "Early",
    longLabel: "Early-Stage Case",
    statusToken: "neutral",
    icon: "arrow-up-right",
    description:
      "Your profile has potential but needs strategic development before filing.",
    range: "0–49",
  },
};

/* ─── Legacy DB tier mapping ───────────────────────────────────────────── */

/** Database `lead.tier` historically holds "tier1" | "tier2" | "tier3".
 * Map at the data-access boundary, not in pages. */
export function legacyTierToCanonical(
  legacy: string | null | undefined,
): Tier {
  if (legacy === "tier1") return "strong";
  if (legacy === "tier2") return "developing";
  return "early";
}

export function canonicalToLegacyTier(tier: Tier): "tier1" | "tier2" | "tier3" {
  if (tier === "strong") return "tier1";
  if (tier === "developing") return "tier2";
  return "tier3";
}

/** Convenience: resolve any tier-ish input into the canonical Tier. */
export function resolveTier(input: string | number | null | undefined): Tier {
  if (typeof input === "number") return tierFor(input);
  if (input === "tier1" || input === "strong" || input === "Strong") return "strong";
  if (input === "tier2" || input === "developing" || input === "Developing" || input === "Borderline") return "developing";
  if (input === "tier3" || input === "early" || input === "Early" || input === "Weak") return "early";
  return "early";
}

/* ─── Letter quality (separate axis from candidate tier) ───────────────── */

export type LetterQuality = "excellent" | "acceptable" | "needs-work";

export const LETTER_QUALITY_THRESHOLDS = {
  excellent: 85,
  acceptable: 70,
} as const;

export function letterQualityFor(score: number): LetterQuality {
  if (score >= LETTER_QUALITY_THRESHOLDS.excellent) return "excellent";
  if (score >= LETTER_QUALITY_THRESHOLDS.acceptable) return "acceptable";
  return "needs-work";
}

export const LETTER_QUALITY_META: Record<
  LetterQuality,
  {
    label: string;
    statusToken: "success" | "warning" | "danger";
  }
> = {
  excellent: { label: "Excellent", statusToken: "success" },
  acceptable: { label: "Acceptable", statusToken: "warning" },
  "needs-work": { label: "Needs work", statusToken: "danger" },
};

/* ─── Evidence ceiling (anti-inflation guard for /check) ───────────────── */

/**
 * A hard, deterministic CEILING on the /check assessment score, derived only
 * from the applicant's self-reported hard evidence.
 *
 * Why this exists: the LLM assessor is prompted to be *encouraging* on the
 * 5-question preliminary pass and will happily score a profile with zero
 * publications and zero citations as "Strong". That is fake/empty-data
 * inflation — an empty profile must never read as a strong NIW candidate. The
 * National Interest Waiver rests on *demonstrated* national-importance impact;
 * with no research output there is no such evidence yet, regardless of degree.
 *
 * This is a CEILING, not a floor — the LLM may always score lower (weak field,
 * no qualifying degree). It can never score higher than the evidence supports.
 * Rules over LLM. Applied in app/api/check/route.ts after the LLM returns.
 *
 * The option strings mirror the <select> values in app/check/page.tsx. Any
 * unmapped value falls through to 100 (no cap) so a new option never silently
 * clamps a real candidate.
 */
export type EvidenceInputs = {
  publications?: string | null;
  citations?: string | null;
  awards?: string | null;
  grants?: string | null;
  patents?: string | null;
};

const PUBLICATION_CEILING: Record<string, number> = {
  "None": 40,
  "1–3": 62,
  "4–10": 78,
  "11–25": 92,
  "More than 25": 100,
};

const CITATION_CEILING: Record<string, number> = {
  "None or unknown": 45,
  "1–50": 65,
  "51–200": 82,
  "201–500": 92,
  "More than 500": 100,
};

export function evidenceCeiling(a: EvidenceInputs): number {
  const pub = a.publications?.trim() ?? "";
  const cite = a.citations?.trim() ?? "";

  // Map an answer to its ceiling. Empty/missing → treat as the bottom (no
  // evidence). A present-but-unmapped value (a future <select> option) falls
  // through to 100 so a new option never silently clamps a real candidate.
  const pubCeil = pub === "" ? 40 : pub in PUBLICATION_CEILING ? PUBLICATION_CEILING[pub] : 100;
  const citeCeil = cite === "" ? 45 : cite in CITATION_CEILING ? CITATION_CEILING[cite] : 100;

  // MAX across the two: a heavily cited researcher with few *listed* papers is
  // still strong (mirrors the trust-score MAX-aggregation philosophy in
  // the scoring contract). "None or unknown" citations never drag down a strong
  // publication record.
  let ceil = Math.max(pubCeil, citeCeil);

  // Standout secondary achievement can lift an otherwise thin research record
  // (the exceptional-ability path). Only the high-signal options qualify.
  const award = a.awards?.trim();
  if (award === "International award or prize") ceil = Math.max(ceil, 88);
  else if (award === "National award or prize") ceil = Math.max(ceil, 80);

  const grant = a.grants?.trim();
  if (grant === "Large grant (over $500K)") ceil = Math.max(ceil, 85);
  else if (grant === "Significant grant ($50K–$500K)") ceil = Math.max(ceil, 75);

  if (a.patents?.trim() === "3 or more") ceil = Math.max(ceil, 75);

  // Empty/fake-data clamp: no publications AND no/unknown citations AND no
  // standout secondary evidence → genuinely early-stage. 35 sits below every
  // positive band — the canonical "developing" tier (50) AND the preliminary
  // snapshot's "Promising" floor (40) — so an empty profile reads as
  // "Early Stage", never Strong or Promising.
  const noPubs = pub === "" || pub === "None";
  const noCites = cite === "" || cite === "None or unknown";
  if (noPubs && noCites && ceil <= 45) ceil = 35;

  return ceil;
}

/**
 * Clamp a candidate score to the evidence ceiling derived from raw /check
 * answers (an object carrying publications/citations/awards/grants/patents
 * string fields — e.g. `Lead.formData`).
 *
 * Apply this at EVERY boundary that persists OR renders a candidate score, so
 * the cap is enforced once at compute time (`/api/check`) and again at each
 * write and at the dossier/brief/cron read paths. One un-clamped value would
 * otherwise desync the whole platform.
 *
 * - A null/undefined score passes through unchanged (nothing to clamp).
 * - If the object carries no publication/citation signal at all, there is no
 *   basis to clamp and the score passes through untouched — this is what stops
 *   an answer-less reassess (`formData: {}`) from nuking a real score to 35.
 */
export function clampScoreToEvidence(
  score: number | null | undefined,
  evidence: Record<string, unknown> | EvidenceInputs | null | undefined,
): number | null | undefined {
  if (score == null || !evidence) return score;
  const e = evidence as Record<string, unknown>;
  const str = (k: string): string | undefined =>
    typeof e[k] === "string" ? (e[k] as string) : undefined;
  const publications = str("publications");
  const citations = str("citations");
  if (publications === undefined && citations === undefined) return score;
  const ceil = evidenceCeiling({
    publications,
    citations,
    awards: str("awards"),
    grants: str("grants"),
    patents: str("patents"),
  });
  return Math.min(score, ceil);
}

/**
 * Resolve the clamped candidate score AND a matching legacy DB tier for a Lead
 * row (raw score + check-answer `formData`). Use at the dossier/brief/cron read
 * boundaries so the score *and* tier rendered into a PDF/.docx are always the
 * evidence-supported pair — even for leads scored before the ceiling existed.
 * Deriving the tier from the *clamped* score keeps the two from ever disagreeing.
 */
export function resolveCandidateScore(
  rawScore: number | null | undefined,
  formData: Record<string, unknown> | null | undefined,
  fallbackTier = "tier3",
): { score: number | null; tier: string } {
  const score = clampScoreToEvidence(rawScore, formData) ?? null;
  const tier = score != null ? canonicalToLegacyTier(tierFor(score)) : fallbackTier;
  return { score, tier };
}
