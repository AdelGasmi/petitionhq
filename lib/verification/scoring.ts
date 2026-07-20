/**
 * Rules-based TRUST score computation (authenticity, not prestige).
 *
 * No LLM — pure deterministic scoring from verification results.
 * Score range: 0–100 (clamped).
 *
 * ── What this score means ───────────────────────────────────────────
 * Trust answers ONE question: "Is this a real, findable researcher whose
 * self-reported claims hold up against public records?" It is NOT a
 * measure of how strong their NIW case is (that is prestige/case-strength,
 * computed elsewhere). Conflating the two is what made a real computer
 * scientist with 10 indexed DBLP papers score 10/100 — he was penalized
 * for the *absence* of sources that never index his field.
 *
 * ── Identity-anchored corroboration (the 2026 rewrite) ──────────────
 * The score is computed AFTER identity reconciliation (`./identity.ts`).
 * Corroboration is credited only for sources that AGREE with a resolved
 * identity anchor — never for the mere fact that a database returned
 * *someone* with the applicant's name. This closes the name-collision
 * hole that let an internal-medicine MD inherit a stranger's
 * microelectronics papers + NSF grants and score 92.
 *
 * ── Design principles ───────────────────────────────────────────────
 * 1. EVIDENCE FLOOR, not additive bonuses. Being corroborated by N
 *    *agreeing* independent sources establishes a trust floor.
 * 2. FIELD-AWARE. A source the field doesn't use is never held against the
 *    applicant; a source from the WRONG field (a CS-only DB for a clinician)
 *    is dropped as a namesake, not counted and not penalized.
 * 3. INTERNATIONAL-FRIENDLY. Non-US grants, ROR-absent institutions, and
 *    works not yet indexed everywhere never subtract points.
 * 4. JUDGE CLAIMS ONLY WHEN SURE WHO THEY ARE. A self-report overclaim
 *    (e.g. "5,000 citations" against a confidently-resolved record showing
 *    ~500) is the ONLY penalty — and it fires only when the identity is
 *    confidently resolved, so honest under-indexing is never flagged.
 * 5. GHOSTS SCORE 0. No corroborating source at all → 0.
 * ────────────────────────────────────────────────────────────────────
 */

import type {
  OpenAlexAuthor,
  OrcidProfile,
  RorOrg,
  Grant,
  Patent,
  CrossrefWork,
  SemanticScholarAuthor,
  ArxivResult,
  DblpResult,
  PubmedResult,
  VerificationSource,
} from "./types";
import type { ResearchField } from "./fields";
import { reconcileIdentity, type IdentityResolution } from "./identity";

export type ScoringInput = {
  openalex?: OpenAlexAuthor | null;
  orcid?: OrcidProfile | null;
  ror?: RorOrg | null;
  nsfGrants?: Grant[];
  nihGrants?: Grant[];
  patents?: Patent[];
  crossrefWorks?: CrossrefWork[];
  semanticScholar?: SemanticScholarAuthor | null;
  arxiv?: ArxivResult | null;
  dblp?: DblpResult | null;
  pubmed?: PubmedResult | null;
  // Detected research field (bucketed) — informational/back-compat. Identity
  // reconciliation re-derives the authoritative field from OpenAlex + the raw
  // self-reported string below.
  field?: ResearchField;
  // Raw self-reported field string from intake (e.g. "internal medicine").
  declaredField?: string;
  // True when applicant proved ORCID ownership via OAuth sign-in.
  orcidAuthenticated?: boolean;
  // Self-reported numbers from intake (used only for consistency checks).
  claimedPublicationCount?: number;
  claimedCitationCount?: number;
  claimedGrantCount?: number;
};

export type ScoringResult = {
  trustScore: number;
  breakdown: { rule: string; points: number; reason: string }[];
  // Surfaced facts (Scholar-comparable aggregation across AGREEING sources).
  aggregatedCitations: number;
  aggregatedWorks: number;
  corroboratingSources: VerificationSource[];
  field?: ResearchField;
  // Identity reconciliation result — the orchestrator uses this to set honest
  // per-claim statuses (e.g. mark a namesake source "ambiguous", not "verified").
  identity: IdentityResolution;
};

// ── Component caps ──────────────────────────────────────────────────
const CAP_IDENTITY = 55; // independent corroboration floor
const CAP_SUBSTANCE = 15; // real body of indexed work
const CAP_CONSISTENCY = 20; // claims line up with public record
const CAP_INSTITUTION = 10; // institution / funding corroboration

export function computeTrustScore(input: ScoringInput): ScoringResult {
  const breakdown: { rule: string; points: number; reason: string }[] = [];

  // ── Identity reconciliation: who is corroborated, and how sure are we? ──
  const identity = reconcileIdentity({
    openalex: input.openalex,
    orcid: input.orcid,
    semanticScholar: input.semanticScholar,
    arxiv: input.arxiv,
    dblp: input.dblp,
    pubmed: input.pubmed,
    crossrefWorks: input.crossrefWorks,
    nsfGrants: input.nsfGrants,
    nihGrants: input.nihGrants,
    patents: input.patents,
    declaredField: input.declaredField,
    orcidAuthenticated: input.orcidAuthenticated,
    claimedPublicationCount: input.claimedPublicationCount,
  });

  const { anchor, basis, agreeingSources, claimCheckEnabled } = identity;
  const field = identity.resolvedField;

  // ── Build the corroborating-source set (drives the identity floor) ──
  // The anchor itself counts as one corroborator when it's an OpenAlex/ORCID
  // resolver; sources_only basis already has its anchor inside agreeingSources.
  const corroborating = new Set<VerificationSource>(agreeingSources);
  if (
    basis === "orcid_deterministic" ||
    basis === "openalex_corroborated" ||
    basis === "openalex_name" ||
    basis === "openalex_ambiguous"
  ) {
    corroborating.add("openalex");
  }
  if (basis === "orcid_only" || basis === "orcid_provided" || basis === "orcid_oauth") corroborating.add("orcid");

  const corroboratingSources = [...corroborating];
  const n = corroborating.size;

  // ── No anchor at all → ghost → 0 (short-circuit) ────────────────────
  if (anchor === "none" || n === 0) {
    breakdown.push({
      rule: "no_sources_found",
      points: 0,
      reason: "No public verification source returned a usable match — unable to corroborate identity",
    });
    return {
      trustScore: 0,
      breakdown,
      aggregatedCitations: 0,
      aggregatedWorks: 0,
      corroboratingSources,
      field,
      identity,
    };
  }

  // ── Aggregated metrics (Scholar-comparable) — over AGREEING sources only ──
  // We never trust a single database to be complete, so we take the MAX across
  // every corroborating source. Crucially, a namesake's numbers cannot leak in,
  // because dropped/unconfirmed sources are not in `corroborating`. Under a LOW
  // (ambiguous) anchor we trust no numbers at all — the resolved record may not
  // even be this person.
  const trustMetrics = anchor !== "low";
  const works: number[] = [];
  const cites: number[] = [];
  const hs: number[] = [];
  if (trustMetrics) {
    if (corroborating.has("openalex") && input.openalex) {
      works.push(input.openalex.worksCount);
      cites.push(input.openalex.citedByCount);
      hs.push(input.openalex.hIndex);
    }
    if (corroborating.has("orcid") && input.orcid) works.push(input.orcid.publicationCount);
    if (corroborating.has("semantic_scholar") && input.semanticScholar) {
      works.push(input.semanticScholar.paperCount);
      cites.push(input.semanticScholar.citationCount);
      hs.push(input.semanticScholar.hIndex);
    }
    if (corroborating.has("dblp") && input.dblp) works.push(input.dblp.publicationCount);
    if (corroborating.has("arxiv") && input.arxiv) works.push(input.arxiv.paperCount);
    if (corroborating.has("pubmed") && input.pubmed) works.push(input.pubmed.paperCount);
    if (corroborating.has("crossref") && input.crossrefWorks) works.push(input.crossrefWorks.length);
  }
  const aggregatedWorks = works.length ? Math.max(...works) : 0;
  const aggregatedCitations = cites.length ? Math.max(...cites) : 0;
  const hIndex = hs.length ? Math.max(...hs) : 0;

  // ── A. Identity corroboration floor (0–55) ─────────────────────────
  let identityFloor = 0;
  if (n >= 3) identityFloor = 55;
  else if (n === 2) identityFloor = 45;
  else if (n === 1) identityFloor = 35;

  breakdown.push({
    rule: "identity_corroboration",
    points: identityFloor,
    reason:
      anchor === "low"
        ? `Identity uncertain (${basis}) — found a candidate but could not independently confirm it is the applicant`
        : `${n} independent public source(s) corroborate this researcher: ${corroboratingSources.join(", ")} (anchor: ${anchor})`,
  });

  // ── B. Publication substance (0–15) ────────────────────────────────
  let substance = 0;
  const substanceReasons: string[] = [];
  if (aggregatedWorks >= 5) {
    substance += 5;
    substanceReasons.push(`${aggregatedWorks} indexed works`);
  } else if (aggregatedWorks >= 1) {
    substance += 3;
    substanceReasons.push(`${aggregatedWorks} indexed work(s)`);
  }
  if (aggregatedCitations >= 200) {
    substance += 7;
    substanceReasons.push(`${aggregatedCitations} aggregated citations`);
  } else if (aggregatedCitations >= 50) {
    substance += 5;
    substanceReasons.push(`${aggregatedCitations} aggregated citations`);
  } else if (aggregatedCitations >= 10) {
    substance += 3;
    substanceReasons.push(`${aggregatedCitations} aggregated citations`);
  }
  if (hIndex >= 10) {
    substance += 3;
    substanceReasons.push(`h-index ${hIndex}`);
  } else if (hIndex >= 5) {
    substance += 2;
    substanceReasons.push(`h-index ${hIndex}`);
  }
  substance = Math.min(substance, CAP_SUBSTANCE);
  if (substance > 0) {
    breakdown.push({
      rule: "publication_substance",
      points: substance,
      reason: `Verified body of work: ${substanceReasons.join(", ")}`,
    });
  }

  // ── C. Claim consistency (−15 to +20) ──────────────────────────────
  // Only evaluated when we have a trusted, resolved body of work to compare
  // against. Under a low/uncertain anchor we neither reward nor penalize
  // self-reports — we simply can't judge them.
  let consistency = 0;
  if (trustMetrics && aggregatedWorks > 0) {
    // Publications
    if (input.claimedPublicationCount && input.claimedPublicationCount > 0) {
      const claimed = input.claimedPublicationCount;
      const ratio = aggregatedWorks / claimed;
      if (ratio >= 0.7) {
        consistency += 15;
        breakdown.push({
          rule: "publication_claim_consistent",
          points: 15,
          reason: `Claimed ${claimed} publications, verified ${aggregatedWorks} (${Math.round(ratio * 100)}% — consistent)`,
        });
      } else if (ratio >= 0.4) {
        consistency += 8;
        breakdown.push({
          rule: "publication_claim_partial",
          points: 8,
          reason: `Claimed ${claimed} publications, verified ${aggregatedWorks} (${Math.round(ratio * 100)}% — partially corroborated; remainder may be unindexed)`,
        });
      } else if (ratio < 0.25 && claimed >= 5 && claimCheckEnabled) {
        // Material overclaim — only when the identity is confidently resolved,
        // so honest under-indexing / split author IDs are never flagged.
        consistency -= 15;
        breakdown.push({
          rule: "publication_claim_contradiction",
          points: -15,
          reason: `Claimed ${claimed} publications but only ${aggregatedWorks} found across all corroborating sources (${Math.round(ratio * 100)}% — material discrepancy on a confidently-resolved profile)`,
        });
      } else {
        breakdown.push({
          rule: "publication_claim_undercounted",
          points: 0,
          reason: `Claimed ${claimed} publications, ${aggregatedWorks} matched — not penalized (indexing lag / unresolved identity)`,
        });
      }
    } else if (!input.claimedPublicationCount) {
      consistency += 8;
      breakdown.push({
        rule: "no_publication_claim",
        points: 8,
        reason: "No self-reported publication count to verify against; identity independently corroborated",
      });
    }

    // Citations — the "claims 5,000, has 500" guard. There is no single source
    // of truth, so we compare the claim against the MAX citations across all
    // corroborating sources (the most generous defensible number) and only flag
    // an egregious, unambiguous overclaim on a confidently-resolved identity.
    if (claimCheckEnabled && input.claimedCitationCount && input.claimedCitationCount >= 100 && aggregatedCitations > 0) {
      const cRatio = aggregatedCitations / input.claimedCitationCount;
      if (cRatio < 0.2) {
        consistency -= 15;
        breakdown.push({
          rule: "citation_claim_overclaim",
          points: -15,
          reason: `Claimed ${input.claimedCitationCount} citations but at most ${aggregatedCitations} found across all corroborating sources (${Math.round(cRatio * 100)}% — material overclaim)`,
        });
      } else if (cRatio < 0.5) {
        breakdown.push({
          rule: "citation_claim_high",
          points: 0,
          reason: `Claimed ${input.claimedCitationCount} citations, ${aggregatedCitations} found — not penalized (citations accrue and index slowly)`,
        });
      }
    }

    // Grants. Crediting found grants requires a confident (high) anchor so a
    // namesake's NSF/NIH awards can't inflate the score. A claimed-but-not-found
    // grant is a small nudge (non-US grants aren't in NSF/NIH) and only when we
    // can actually judge the claim — never disqualifying.
    if (input.claimedGrantCount && input.claimedGrantCount > 0) {
      const grants = [...(input.nsfGrants ?? []), ...(input.nihGrants ?? [])];
      const grantsCredited = anchor === "high" && grants.length > 0;
      if (grantsCredited) {
        consistency += 5;
        breakdown.push({
          rule: "grant_claim_consistent",
          points: 5,
          reason: `Claimed ${input.claimedGrantCount} grant(s); ${grants.length} found in NSF/NIH (identity confirmed)`,
        });
      }
      // No penalty for missing US grants: NSF/NIH don't index international
      // funders (NSERC, ERC, DFG, etc.). A claimed grant not found in NSF/NIH
      // is not evidence of dishonesty — it's evidence of a non-US funder.
    }
  }
  consistency = Math.max(-15, Math.min(consistency, CAP_CONSISTENCY));

  // ── D. Institution / funding corroboration (0–10) ──────────────────
  let institution = 0;
  const instReasons: string[] = [];
  if (input.ror && input.ror.types.includes("education")) {
    institution += 6;
    instReasons.push(`institution "${input.ror.name}" verified (education, ${input.ror.country})`);
  } else if (input.ror) {
    institution += 3;
    instReasons.push(`institution "${input.ror.name}" found in ROR (${input.ror.types.join(", ")})`);
  }
  // Grants/patents corroborate funding only under a confident anchor (the
  // namesake guard) — same rule as crediting them in consistency.
  const grants = [...(input.nsfGrants ?? []), ...(input.nihGrants ?? [])];
  if (anchor === "high" && grants.length > 0) {
    institution += 4;
    instReasons.push(`${grants.length} grant(s) (${input.nsfGrants?.length ?? 0} NSF, ${input.nihGrants?.length ?? 0} NIH)`);
  }
  if (anchor === "high" && (input.patents?.length ?? 0) > 0) {
    institution += 2;
    instReasons.push(`${input.patents!.length} patent(s)`);
  }
  institution = Math.min(institution, CAP_INSTITUTION);
  if (institution > 0) {
    breakdown.push({
      rule: "institution_funding",
      points: institution,
      reason: `Affiliation / funding corroboration: ${instReasons.join(", ")}`,
    });
  }

  const raw = identityFloor + substance + consistency + institution;
  const trustScore = Math.max(0, Math.min(100, raw));

  return {
    trustScore,
    breakdown,
    aggregatedCitations,
    aggregatedWorks,
    corroboratingSources,
    field,
    identity,
  };
}
