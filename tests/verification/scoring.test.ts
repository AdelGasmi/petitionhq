/**
 * Trust score computation tests (evidence-floor, field-aware model).
 *
 * Pure unit tests — no DB, no network. Trust measures AUTHENTICITY
 * (is this a real, findable researcher whose claims hold up?), not
 * prestige. The headline guarantee: a real researcher corroborated by
 * multiple public sources never scores punitively low just because an
 * irrelevant source (or institution metadata) is missing.
 */

import { describe, it, expect } from "vitest";
import { computeTrustScore, type ScoringInput } from "@/lib/verification/scoring";
import type {
  OpenAlexAuthor,
  OrcidProfile,
  RorOrg,
  Grant,
  SemanticScholarAuthor,
  DblpResult,
  ArxivResult,
  PubmedResult,
} from "@/lib/verification/types";

// ─── Fixtures ──────────────────────────────────────────────────────

const makeAuthor = (overrides: Partial<OpenAlexAuthor> = {}): OpenAlexAuthor => ({
  id: "A1234567890",
  displayName: "Test Author",
  institution: "Test University",
  worksCount: 150,
  citedByCount: 5000,
  hIndex: 30,
  sourceUrl: "https://openalex.org/A1234567890",
  confidence: 0.9,
  matchSignals: ["name_exact"],
  affiliationRorIds: [],
  ...overrides,
});

const makeOrcid = (overrides: Partial<OrcidProfile> = {}): OrcidProfile => ({
  orcidId: "0000-0002-1234-5678",
  displayName: "Test Author",
  currentAffiliation: "Test University",
  publicationCount: 120,
  sourceUrl: "https://orcid.org/0000-0002-1234-5678",
  confidence: 0.8,
  ...overrides,
});

const makeRor = (overrides: Partial<RorOrg> = {}): RorOrg => ({
  id: "https://ror.org/01234abc",
  name: "Test University",
  acronyms: ["TU"],
  country: "United States",
  types: ["education"],
  sourceUrl: "https://ror.org/01234abc",
  confidence: 0.95,
  ...overrides,
});

const makeGrant = (agency: "nsf" | "nih", overrides: Partial<Grant> = {}): Grant => ({
  id: "NSF-1234567",
  title: "Test Grant",
  piName: "Test Author",
  agency,
  sourceUrl: `https://${agency === "nsf" ? "nsf.gov" : "reporter.nih.gov"}/award/1234567`,
  confidence: 0.85,
  ...overrides,
});

const makeS2 = (overrides: Partial<SemanticScholarAuthor> = {}): SemanticScholarAuthor => ({
  id: "S123",
  displayName: "Test Author",
  paperCount: 140,
  citationCount: 5200,
  hIndex: 29,
  influentialCitationCount: 400,
  sourceUrl: "https://www.semanticscholar.org/author/S123",
  confidence: 0.8,
  ...overrides,
});

const makeDblp = (overrides: Partial<DblpResult> = {}): DblpResult => ({
  authorName: "Test Author",
  authorUrl: "https://dblp.org/pid/123",
  publicationCount: 40,
  venueBreakdown: { conferences: 25, journals: 10, other: 5 },
  topVenues: ["NeurIPS", "CVPR"],
  sourceUrl: "https://dblp.org/pid/123",
  confidence: 0.6,
  ...overrides,
});

const makeArxiv = (overrides: Partial<ArxivResult> = {}): ArxivResult => ({
  authorName: "Test Author",
  paperCount: 20,
  papers: [],
  sourceUrl: "https://arxiv.org/a/test",
  confidence: 0.6,
  ...overrides,
});

const makePubmed = (overrides: Partial<PubmedResult> = {}): PubmedResult => ({
  authorName: "Test Author",
  paperCount: 15,
  recentCount: 6,
  topJournals: [],
  sourceUrl: "https://pubmed.ncbi.nlm.nih.gov/?term=test",
  confidence: 0.6,
  ...overrides,
});

// ─── Tests ─────────────────────────────────────────────────────────

describe("computeTrustScore", () => {
  it("THE REGRESSION GUARD: a real CS researcher with NO institution and 3+ corroborating sources scores well above the M7 threshold", () => {
    // This is the Mustapha Bounoua case that originally scored 10/100.
    const input: ScoringInput = {
      field: "cs",
      openalex: makeAuthor({ displayName: "Mustapha Bounoua", institution: undefined, worksCount: 12, citedByCount: 90, hIndex: 5, confidence: 0.65 }),
      semanticScholar: makeS2({ displayName: "Mustapha Bounoua", paperCount: 12, citationCount: 95, hIndex: 5, influentialCitationCount: 8 }),
      dblp: makeDblp({ authorName: "Mustapha Bounoua", publicationCount: 10 }),
      arxiv: makeArxiv({ authorName: "Mustapha Bounoua", paperCount: 6 }),
      claimedPublicationCount: 7,
    };

    const { trustScore } = computeTrustScore(input);

    expect(trustScore).toBeGreaterThanOrEqual(60); // attorney-ready floor
    expect(trustScore).toBeGreaterThan(50); // emphatically not the old 10
  });

  it("scores a rich, fully-corroborated profile near maximum", () => {
    const input: ScoringInput = {
      field: "biomed",
      openalex: makeAuthor({ worksCount: 300, citedByCount: 90000, hIndex: 120 }),
      orcid: makeOrcid(),
      semanticScholar: makeS2({ citationCount: 95000, hIndex: 120 }),
      ror: makeRor({ types: ["education"] }),
      nihGrants: [makeGrant("nih")],
      claimedPublicationCount: 250,
      claimedGrantCount: 1,
    };

    const { trustScore } = computeTrustScore(input);
    expect(trustScore).toBe(100);
  });

  it("scores 0 when no public source corroborates the person, even with big claims", () => {
    const input: ScoringInput = {
      field: "other",
      openalex: null,
      orcid: null,
      ror: null,
      nsfGrants: [],
      nihGrants: [],
      patents: [],
      claimedPublicationCount: 200,
      claimedCitationCount: 9000,
    };

    const { trustScore, breakdown } = computeTrustScore(input);
    expect(trustScore).toBe(0);
    expect(breakdown.map((b) => b.rule)).toContain("no_sources_found");
  });

  it("identity floor increases with the number of independent sources", () => {
    const one = computeTrustScore({ openalex: makeAuthor() });
    const two = computeTrustScore({ openalex: makeAuthor(), semanticScholar: makeS2() });
    const three = computeTrustScore({ openalex: makeAuthor(), semanticScholar: makeS2(), dblp: makeDblp() });

    const floor = (r: ReturnType<typeof computeTrustScore>) =>
      r.breakdown.find((b) => b.rule === "identity_corroboration")!.points;

    expect(floor(one)).toBe(35);
    expect(floor(two)).toBe(45);
    expect(floor(three)).toBe(55);
  });

  it("penalises a MATERIAL overclaim on an ID-ANCHORED identity, but does not zero a real person", () => {
    // The penalty fires ONLY when we fetched the applicant's own record (here a
    // deterministic ORCID→OpenAlex resolution), so we truly know their output.
    const input: ScoringInput = {
      declaredField: "computer science",
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0, worksCount: 3, citedByCount: 5, hIndex: 1 }),
      semanticScholar: makeS2({ paperCount: 3, citationCount: 5, hIndex: 1, influentialCitationCount: 0 }),
      claimedPublicationCount: 50, // claims 50, only 3 found → material discrepancy
    };

    const { trustScore, breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).toContain("publication_claim_contradiction");
    expect(trustScore).toBeGreaterThan(0); // they're real, just exaggerating
    expect(trustScore).toBeLessThan(45); // but materially dinged
  });

  it("NEVER brands a NAME-resolved researcher an overclaimer (the Achouak harm)", () => {
    // Identical numbers, but a NAME-search OpenAlex match (not ID-anchored).
    // Public indexes undercount real researchers, so a high self-report is
    // treated as indexing lag — never as a contradiction.
    const input: ScoringInput = {
      declaredField: "computer science",
      openalex: makeAuthor({ matchQuality: "fuzzy", confidence: 0.85, worksCount: 3, citedByCount: 5, hIndex: 1, matchSignals: ["name_exact"] }),
      semanticScholar: makeS2({ paperCount: 3, citationCount: 5, hIndex: 1, influentialCitationCount: 0 }),
      claimedPublicationCount: 50,
    };

    const { breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).not.toContain("publication_claim_contradiction");
  });

  it("does NOT penalise indexing lag — partial verification still earns credit", () => {
    const input: ScoringInput = {
      field: "physics",
      openalex: makeAuthor({ worksCount: 6 }),
      arxiv: makeArxiv({ paperCount: 6 }),
      claimedPublicationCount: 12, // verified 6 of 12 → 50% → partial, not contradiction
    };

    const { breakdown } = computeTrustScore(input);
    const rules = breakdown.map((b) => b.rule);
    expect(rules).toContain("publication_claim_partial");
    expect(rules).not.toContain("publication_claim_contradiction");
  });

  it("treats a missing self-reported count as neutral-positive, not as risk", () => {
    const input: ScoringInput = {
      field: "math",
      openalex: makeAuthor({ worksCount: 30 }),
      arxiv: makeArxiv({ paperCount: 30 }),
      // no claimedPublicationCount
    };

    const { breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).toContain("no_publication_claim");
  });

  it("grant-claim miss carries no penalty — NSF/NIH don't index international funders", () => {
    const input: ScoringInput = {
      field: "engineering",
      openalex: makeAuthor(),
      semanticScholar: makeS2(),
      claimedGrantCount: 2, // claims grants (e.g. NSERC/ERC), none found in NSF/NIH
    };

    const { breakdown } = computeTrustScore(input);
    // No penalty: missing US-grant match is NOT evidence of dishonesty
    expect(breakdown.map((b) => b.rule)).not.toContain("grant_claim_unverified");
  });

  // ── TRU-3 edge-case regression suite ───────────────────────────────

  it("TRU-3: citation overclaim gate is proportional (claimed 499 with only 5 actual)", () => {
    // Old gate was >= 500; new gate is >= 100 — claimed 499 should now fire.
    const input: ScoringInput = {
      declaredField: "computer science",
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0, worksCount: 10, citedByCount: 5, hIndex: 2 }),
      semanticScholar: makeS2({ paperCount: 10, citationCount: 5, hIndex: 2, influentialCitationCount: 0 }),
      claimedPublicationCount: 10,
      claimedCitationCount: 499, // just below old 500 cliff — should be caught by new 100 floor
    };

    const { breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).toContain("citation_claim_overclaim");
  });

  it("TRU-3: publication overclaim gate is proportional (claimed 9 with only 2 actual)", () => {
    // Old gate was claimed >= 10; new gate is >= 5 — claimed 9 with ratio < 0.25 should fire.
    const input: ScoringInput = {
      declaredField: "physics",
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0, worksCount: 2, citedByCount: 30, hIndex: 2 }),
      semanticScholar: makeS2({ paperCount: 2, citationCount: 28, hIndex: 2, influentialCitationCount: 0 }),
      claimedPublicationCount: 9, // just below old 10 cliff, ratio 2/9 ≈ 0.22 < 0.25
    };

    const { breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).toContain("publication_claim_contradiction");
  });

  it("TRU-3: international researcher with non-US grants gets no penalty", () => {
    // Legit researcher with NSERC / ERC grants — not in NSF/NIH → should not lose points.
    const input: ScoringInput = {
      declaredField: "engineering",
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0 }),
      ror: makeRor({ country: "Canada" }),
      claimedGrantCount: 3, // real grants, just not US federal
      // nsfGrants / nihGrants intentionally absent
    };

    const { breakdown, trustScore } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).not.toContain("grant_claim_unverified");
    expect(trustScore).toBeGreaterThan(40); // corroborated + real institution
  });

  it("aggregates citations/works as the MAX across free sources (Scholar-comparable)", () => {
    const input: ScoringInput = {
      openalex: makeAuthor({ worksCount: 40, citedByCount: 1000 }),
      semanticScholar: makeS2({ paperCount: 55, citationCount: 1800 }),
    };

    const { aggregatedWorks, aggregatedCitations } = computeTrustScore(input);
    expect(aggregatedWorks).toBe(55);
    expect(aggregatedCitations).toBe(1800);
  });

  // ─── Identity reconciliation: the name-collision guard ──────────────

  it("THE NAME-COLLISION GUARD: an ambiguous anchor + cross-field namesakes scores LOW, not 92", () => {
    // The internal-medicine MD who inherited a stranger's microelectronics
    // papers (DBLP), NSF grants, and a 102-pub ORCID — and scored 92/100.
    const input: ScoringInput = {
      declaredField: "internal medicine", // → biomed
      openalex: makeAuthor({
        worksCount: 85,
        citedByCount: 1649,
        hIndex: 20,
        matchQuality: "ambiguous",
        confidence: 0.55,
        matchSignals: ["name_partial", "ambiguous_top2"],
      }),
      semanticScholar: makeS2({ paperCount: 53, citationCount: 76, hIndex: 4, influentialCitationCount: 0 }),
      dblp: makeDblp({ publicationCount: 60, topVenues: [], venueBreakdown: { conferences: 25, journals: 35, other: 0 } }),
      nsfGrants: [makeGrant("nsf"), makeGrant("nsf"), makeGrant("nsf"), makeGrant("nsf")],
      pubmed: makePubmed({ paperCount: 15 }),
      orcid: makeOrcid({ publicationCount: 102, confidence: 0.5 }),
      claimedPublicationCount: 8,
      claimedCitationCount: 200,
    };

    const { trustScore, identity } = computeTrustScore(input);

    expect(identity.anchor).toBe("low");
    expect(identity.verdicts.dblp).toBe("field_mismatch"); // CS-only DB for a clinician
    expect(identity.verdicts.nsf).toBe("unconfirmed");     // US grants, identity unconfirmed
    expect(trustScore).toBeLessThan(50);                   // emphatically not 92
    expect(trustScore).toBeGreaterThan(0);                 // a person by this name plausibly exists
  });

  it("excludes a namesake's metrics from aggregation (drops, never penalizes)", () => {
    // Real, ORCID-resolved biomed researcher + a stray CS DBLP superstar namesake.
    const input: ScoringInput = {
      declaredField: "molecular biology", // → biomed
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0, worksCount: 30, citedByCount: 400, hIndex: 10, matchSignals: ["orcid_deterministic"] }),
      pubmed: makePubmed({ paperCount: 28 }),
      dblp: makeDblp({ publicationCount: 200 }), // namesake CS superstar
      claimedPublicationCount: 30,
    };

    const { trustScore, identity, aggregatedWorks } = computeTrustScore(input);
    expect(identity.verdicts.dblp).toBe("field_mismatch");
    expect(aggregatedWorks).toBe(30);              // NOT 200 — namesake excluded
    expect(trustScore).toBeGreaterThanOrEqual(60); // the real researcher still scores well
  });

  // ─── Self-report overclaim (only on a confidently-resolved identity) ──

  it("catches a material CITATION overclaim (claims 5,000, has ~500) on a resolved identity", () => {
    const input: ScoringInput = {
      declaredField: "computer science",
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0, worksCount: 20, citedByCount: 500, hIndex: 8 }),
      semanticScholar: makeS2({ paperCount: 20, citationCount: 480, hIndex: 8, influentialCitationCount: 20 }),
      claimedPublicationCount: 18,
      claimedCitationCount: 5000,
    };

    const { trustScore, breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).toContain("citation_claim_overclaim");
    expect(trustScore).toBeGreaterThan(0); // real person
    expect(trustScore).toBeLessThan(70);   // but dinged
  });

  it("does NOT flag honest citation under-counting (claims 1,000, found 300 — citations index slowly)", () => {
    const input: ScoringInput = {
      declaredField: "physics",
      openalex: makeAuthor({ matchQuality: "deterministic", confidence: 1.0, worksCount: 40, citedByCount: 300, hIndex: 9 }),
      semanticScholar: makeS2({ paperCount: 40, citationCount: 320, hIndex: 9 }),
      claimedPublicationCount: 40,
      claimedCitationCount: 1000,
    };

    const { breakdown } = computeTrustScore(input);
    expect(breakdown.map((b) => b.rule)).not.toContain("citation_claim_overclaim");
  });

  it("does NOT flag a citation overclaim when identity is only weakly resolved", () => {
    // Name-only OpenAlex match, no second source → we can't be sure we have
    // their full record, so a big claim is NOT treated as a lie.
    const input: ScoringInput = {
      declaredField: "chemistry",
      openalex: makeAuthor({ worksCount: 10, citedByCount: 300, hIndex: 6, matchSignals: ["name_exact"] }),
      claimedCitationCount: 5000,
    };

    const { breakdown, identity } = computeTrustScore(input);
    expect(identity.claimCheckEnabled).toBe(false);
    expect(breakdown.map((b) => b.rule)).not.toContain("citation_claim_overclaim");
  });

  it("never exceeds 100 or drops below 0", () => {
    const max = computeTrustScore({
      openalex: makeAuthor({ worksCount: 500, citedByCount: 200000, hIndex: 200 }),
      orcid: makeOrcid(),
      semanticScholar: makeS2({ citationCount: 200000, hIndex: 200 }),
      ror: makeRor(),
      nsfGrants: [makeGrant("nsf")],
      nihGrants: [makeGrant("nih")],
      claimedPublicationCount: 500,
      claimedGrantCount: 2,
    });
    expect(max.trustScore).toBeLessThanOrEqual(100);
    expect(max.trustScore).toBeGreaterThanOrEqual(0);
  });

  // ─── TRU-7: cross-source rescue (the "Saifur Rahman" regression) ────

  it("THE SAIFUR REGRESSION: a real, modest researcher buried under a famous namesake scores ABOVE the gate (was 41)", () => {
    // OpenAlex resolves the IEEE-Fellow namesake (331 pubs / 2,382 cit) and
    // flags it ambiguous. Pre-fix this collapsed every source to "unconfirmed"
    // and floored the score at 35 + 6 = 41. The real applicant is the modest,
    // claim-consistent record echoed across Semantic Scholar / arXiv / Crossref.
    const input: ScoringInput = {
      declaredField: "agricultural extension", // → "other"
      openalex: makeAuthor({
        displayName: "Saifur Rahman",
        worksCount: 331,
        citedByCount: 2382,
        hIndex: 14,
        matchQuality: "ambiguous",
        confidence: 0.55,
        matchSignals: ["name_partial", "ambiguous_top2"],
      }),
      semanticScholar: makeS2({ paperCount: 2, citationCount: 25, hIndex: 2, influentialCitationCount: 1 }),
      arxiv: makeArxiv({ paperCount: 5 }),
      crossrefWorks: [
        { doi: "10.0/1", title: "A", authors: ["Saifur Rahman"], publicationYear: 2023, citedByCount: 1, sourceUrl: "https://doi.org/10.0/1" },
        { doi: "10.0/2", title: "B", authors: ["Saifur Rahman"], publicationYear: 2022, citedByCount: 2, sourceUrl: "https://doi.org/10.0/2" },
        { doi: "10.0/3", title: "C", authors: ["Saifur Rahman"], publicationYear: 2021, citedByCount: 0, sourceUrl: "https://doi.org/10.0/3" },
      ],
      dblp: makeDblp({ publicationCount: 62 }),   // namesake CS record — dwarfs the claim
      orcid: makeOrcid({ publicationCount: 18 }), // also dwarfs the claim → excluded
      nsfGrants: [makeGrant("nsf")],              // namesake grants — not credited
      ror: makeRor({ name: "North Carolina State University", types: ["education"] }),
      claimedPublicationCount: 3,
    };

    const { trustScore, aggregatedWorks, aggregatedCitations, identity } = computeTrustScore(input);

    expect(identity.anchor).toBe("medium");
    expect(identity.basis).toBe("sources_only");
    // The namesake's inflated metrics MUST NOT leak into the aggregate.
    expect(aggregatedWorks).toBe(5);     // max(2,5,3) — not 331/62/18
    expect(aggregatedCitations).toBe(25); // S2 — not 2,382
    // The whole point: this honest researcher now clears the attorney gate.
    expect(trustScore).toBeGreaterThanOrEqual(60);
    expect(trustScore).toBeGreaterThan(41);
  });

  it("THE ACHOUAK REGRESSION: a real PhD candidate clears the gate and is NOT branded a fraud", () => {
    // Post-merge OpenAlex record (the 9-work / 21-cit "A. Benarbia" fragment at
    // UND), name-resolved ORCID + Crossref. She self-reported more than the APIs
    // index — junior researchers' recent work lags. Pre-fix: trust 39 WITH a -15
    // fraud penalty. Now: identity holds, no penalty, above the gate.
    const input: ScoringInput = {
      declaredField: "energy engineering", // → engineering
      openalex: makeAuthor({
        displayName: "A. Benarbia",
        worksCount: 9,
        citedByCount: 21,
        hIndex: 2,
        matchQuality: "fuzzy",
        confidence: 0.9,
        matchSignals: ["name_partial", "institution_match", "has_works"],
      }),
      orcid: makeOrcid({ displayName: "Achouak Benarbia", publicationCount: 4, confidence: 0.6 }),
      crossrefWorks: [
        { doi: "10.1/a", title: "x", authors: ["Achouak Benarbia"], publicationYear: 2024, citedByCount: 3, sourceUrl: "https://doi.org/10.1/a" },
      ],
      ror: makeRor({ name: "University of North Dakota", types: ["education"] }),
      claimedPublicationCount: 20,  // more than indexed — indexing lag, not fraud
      claimedCitationCount: 53,
    };

    const { trustScore, breakdown, identity } = computeTrustScore(input);

    expect(identity.anchor).toBe("high"); // institution signal → publicly corroborated
    expect(breakdown.map((b) => b.rule)).not.toContain("publication_claim_contradiction");
    expect(breakdown.map((b) => b.rule)).not.toContain("citation_claim_overclaim");
    expect(trustScore).toBeGreaterThanOrEqual(60);
  });
});
