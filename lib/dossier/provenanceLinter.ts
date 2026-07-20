/**
 * Post-generation provenance linter.
 *
 * Rules-based (no LLM): scans dossier section text for factual claims
 * that lack either a verified-source citation or a [self-reported] tag.
 * Produces a list of flagged lines for human review.
 */

type ClaimResult = {
  status: string;
  source: string;
  sourceUrl?: string;
  confidence: number;
  detail?: string;
};

type VerifiedClaims = Record<string, ClaimResult>;

export type LintIssue = {
  section: string;
  line: string;
  reason: string;
  severity: "warning" | "error";
};

export type LintResult = {
  issues: LintIssue[];
  stats: {
    totalClaims: number;
    verifiedCited: number;
    selfReportedTagged: number;
    untagged: number;
  };
};

// Numbers that look like factual metrics (citations, publications, etc.).
// Catches single-digit claims (e.g. "5 patents") — non-metric words like
// "years" or "advisors" are not in the keyword list so they don't trigger.
const METRIC_PATTERN = /\b(\d+)\s*(publications?|papers?|citations?|articles?|patents?|grants?|awards?|talks?|presentations?|h-index|impact factor)\b/gi;

// Known source tags in dossier output
const SOURCE_TAG_PATTERN = /\[(OpenAlex|ORCID|ROR|NSF|NIH|USPTO|Crossref|verified)\]/gi;
const SELF_REPORTED_PATTERN = /\[self-reported[:\s]?[^\]]*\]/gi;

/**
 * Lint a single dossier section for untagged factual claims.
 */
function lintSection(
  sectionName: string,
  text: string,
  verifiedClaims: VerifiedClaims | null,
): LintIssue[] {
  const issues: LintIssue[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed || trimmed.length < 15) continue;

    // Check if this sentence contains a numeric metric claim
    const metricMatches = [...trimmed.matchAll(METRIC_PATTERN)];
    for (const match of metricMatches) {
      const hasSourceTag = SOURCE_TAG_PATTERN.test(trimmed);
      const hasSelfReported = SELF_REPORTED_PATTERN.test(trimmed);

      // Reset regex lastIndex since we used global flags
      SOURCE_TAG_PATTERN.lastIndex = 0;
      SELF_REPORTED_PATTERN.lastIndex = 0;

      if (!hasSourceTag && !hasSelfReported) {
        // Check if this metric is covered by verified claims
        const metricValue = parseInt(match[1], 10);
        const metricType = match[2].toLowerCase().replace(/s$/, "");
        const isCoveredByVerification = isMetricVerified(
          metricValue,
          metricType,
          verifiedClaims,
        );

        if (!isCoveredByVerification) {
          issues.push({
            section: sectionName,
            line: trimmed.slice(0, 120) + (trimmed.length > 120 ? "..." : ""),
            reason: `Numeric claim "${match[0]}" lacks source citation or [self-reported] tag`,
            severity: "warning",
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Check if a numeric metric is covered by verified claims.
 * Returns true if the number is close to what verification found.
 */
function isMetricVerified(
  value: number,
  type: string,
  verifiedClaims: VerifiedClaims | null,
): boolean {
  if (!verifiedClaims) return false;

  // Check if any verified claim's detail contains a similar number
  for (const [, claim] of Object.entries(verifiedClaims)) {
    if (claim.status !== "verified" || !claim.detail) continue;

    // Extract numbers from the detail string
    const detailNumbers = [...claim.detail.matchAll(/(\d+)/g)].map((m) =>
      parseInt(m[1], 10),
    );

    for (const detailNum of detailNumbers) {
      // Allow 20% tolerance (same as scoring rules)
      const ratio = value / detailNum;
      if (ratio >= 0.8 && ratio <= 1.2) {
        // Number matches a verified source — check if type is related
        const detailLower = claim.detail.toLowerCase();
        if (
          (type === "publication" || type === "paper" || type === "article") &&
          (detailLower.includes("publication") || detailLower.includes("paper") || detailLower.includes("work"))
        ) {
          return true;
        }
        if (
          type === "citation" &&
          detailLower.includes("citation")
        ) {
          return true;
        }
        if (type === "patent" && detailLower.includes("patent")) return true;
        if (type === "grant" && detailLower.includes("grant")) return true;
        if (type === "award" && detailLower.includes("award")) return true;
      }
    }
  }

  return false;
}

/**
 * Lint all dossier sections.
 * Returns a LintResult indicating whether the dossier passed review.
 */
export function lintDossierProvenance(
  sections: { name: string; text: string }[],
  verifiedClaims: VerifiedClaims | null,
): LintResult {
  const allIssues: LintIssue[] = [];
  let verifiedCited = 0;
  let selfReportedTagged = 0;
  let totalClaims = 0;

  for (const section of sections) {
    // Count verified citations
    const sourceTags = [...section.text.matchAll(SOURCE_TAG_PATTERN)];
    SOURCE_TAG_PATTERN.lastIndex = 0;
    verifiedCited += sourceTags.length;

    // Count self-reported tags
    const selfTags = [...section.text.matchAll(SELF_REPORTED_PATTERN)];
    SELF_REPORTED_PATTERN.lastIndex = 0;
    selfReportedTagged += selfTags.length;

    // Count total metric claims
    const metrics = [...section.text.matchAll(METRIC_PATTERN)];
    METRIC_PATTERN.lastIndex = 0;
    totalClaims += metrics.length;

    // Lint
    const issues = lintSection(section.name, section.text, verifiedClaims);
    allIssues.push(...issues);
  }

  return {
    issues: allIssues,
    stats: {
      totalClaims,
      verifiedCited,
      selfReportedTagged,
      untagged: allIssues.length,
    },
  };
}
