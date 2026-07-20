import { describe, it, expect } from "vitest";
import { reconcileIdentity } from "@/lib/verification/identity";

// Minimal OpenAlex stub for test inputs
function oa(
  worksCount: number,
  signals: string[] = [],
  quality: "deterministic" | "fuzzy" | "ambiguous" = "fuzzy",
) {
  return {
    id: "A123",
    displayName: "Test Researcher",
    worksCount,
    citedByCount: worksCount * 8,
    hIndex: Math.floor(worksCount / 5),
    topField: "computer science",
    matchQuality: quality,
    matchSignals: signals,
    confidence: 0.85,
    sourceUrl: "https://openalex.org/A123",
    affiliationRorIds: [] as string[],
  };
}

describe("reconcileIdentity", () => {
  describe("TRU-4: namesake guard under name-only high anchor", () => {
    it("downgrades institution-signal anchor when OA record is far more prolific than self-report", () => {
      const result = reconcileIdentity({
        openalex: oa(500, ["institution_match"]),
        declaredField: "computer science",
        claimedPublicationCount: 5, // 100× ratio — implausible
      });

      // Should NOT get "high" anchor (namesake at same institution)
      expect(result.anchor).toBe("medium");
      expect(result.basis).toBe("openalex_name");
      expect(result.reasons.some((r) => r.includes("TRU-4"))).toBe(true);
    });

    it("downgrades when field_match signal triggers but ratio is extreme", () => {
      const result = reconcileIdentity({
        openalex: oa(300, ["field_match"]),
        declaredField: "computer science",
        claimedPublicationCount: 4, // 75× ratio
      });

      expect(result.anchor).toBe("medium");
      expect(result.basis).toBe("openalex_name");
    });

    it("does NOT downgrade when another source also corroborates (cross-source evidence)", () => {
      const result = reconcileIdentity({
        openalex: oa(500, ["institution_match"]),
        // DBLP also agrees → agreeingFromChecked.length = 1 ≠ 0, bypass TRU-4
        dblp: { authorName: "Test Researcher", authorUrl: "https://dblp.org/pid/x", publicationCount: 480, venueBreakdown: { conferences: 200, journals: 200, other: 80 }, topVenues: [], sourceUrl: "https://dblp.org", confidence: 0.85 },
        declaredField: "computer science",
        claimedPublicationCount: 5,
      });

      // OA + DBLP together → openalex_corroborated, high (TRU-4 only fires when OA-alone)
      expect(result.basis).toBe("openalex_corroborated");
      expect(result.anchor).toBe("high");
    });

    it("does NOT downgrade a genuine under-indexed researcher (low OA, rich DBLP)", () => {
      const result = reconcileIdentity({
        openalex: oa(5, ["institution_match"]), // OA undercounts
        dblp: { authorName: "Test Researcher", authorUrl: "https://dblp.org/pid/x", publicationCount: 50, venueBreakdown: { conferences: 20, journals: 25, other: 5 }, topVenues: [], sourceUrl: "https://dblp.org", confidence: 0.85 }, // real body of work in DBLP
        declaredField: "computer science",
        claimedPublicationCount: 45, // 5/45 ratio — OA << claimed, not the namesake pattern
      });

      // oa.worksCount (5) < max(50, 45×10=450) → TRU-4 does NOT fire
      // dblp agrees → openalex_corroborated
      expect(result.basis).toBe("openalex_corroborated");
      expect(result.anchor).toBe("high");
    });

    it("does NOT downgrade when ORCID OAuth is present (ownership proven)", () => {
      const result = reconcileIdentity({
        openalex: oa(500, ["institution_match"]),
        claimedPublicationCount: 5,
        orcidAuthenticated: true,
      });

      // OAuth proof overrides TRU-4
      expect(result.anchor).toBe("high");
      expect(result.basis).toBe("orcid_oauth");
    });

    it("does NOT downgrade when OA works count is below the floor (50)", () => {
      const result = reconcileIdentity({
        openalex: oa(30, ["institution_match"]), // 30 < 50 floor
        claimedPublicationCount: 2, // 15× ratio but OA count < 50
      });

      // max(50, 2×10=20) = 50 > 30 → no downgrade
      expect(result.anchor).toBe("high");
      expect(result.basis).toBe("openalex_corroborated");
    });

    it("does NOT downgrade a prolific researcher who self-reports conservatively", () => {
      const result = reconcileIdentity({
        openalex: oa(200, ["institution_match"]),
        claimedPublicationCount: 30, // ~7× ratio, below 10× threshold
      });

      // 200 < max(50, 30×10=300) → no downgrade
      expect(result.anchor).toBe("high");
      expect(result.basis).toBe("openalex_corroborated");
    });

    it("does NOT downgrade when no claimedPublicationCount (no self-report to compare)", () => {
      const result = reconcileIdentity({
        openalex: oa(500, ["institution_match"]),
        // No claimedPublicationCount provided
      });

      // TRU-4 guard requires a self-report to compare against
      expect(result.basis).toBe("openalex_corroborated");
      expect(result.anchor).toBe("high");
    });

    it("deterministic (ORCID→OA direct lookup) anchor is never downgraded by TRU-4", () => {
      const result = reconcileIdentity({
        openalex: oa(500, ["institution_match"], "deterministic"), // direct ORCID→OA lookup
        claimedPublicationCount: 5,
      });

      // deterministic takes the orcid_deterministic basis, not openalex_corroborated
      expect(result.basis).toBe("orcid_deterministic");
      expect(result.anchor).toBe("high");
    });
  });

  describe("TRU-7: cross-source rescue of an ambiguous OpenAlex namesake", () => {
    const s2 = (paperCount: number) => ({
      id: "S1", displayName: "Saifur Rahman", paperCount, citationCount: paperCount * 12,
      hIndex: 2, influentialCitationCount: 1, sourceUrl: "https://semanticscholar.org/S1", confidence: 0.7,
    });
    const arxiv = (paperCount: number) => ({
      authorName: "Saifur Rahman", paperCount, papers: [], sourceUrl: "https://arxiv.org/a/x", confidence: 0.6,
    });
    const dblp = (publicationCount: number) => ({
      authorName: "Saifur Rahman", authorUrl: "https://dblp.org/pid/x", publicationCount,
      venueBreakdown: { conferences: 1, journals: 1, other: 0 }, topVenues: [], sourceUrl: "https://dblp.org", confidence: 0.6,
    });
    const crossref = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        doi: `10.0/${i}`, title: "Paper", authors: ["Saifur Rahman"], publicationYear: 2023,
        citedByCount: 1, sourceUrl: "https://doi.org/10.0",
      }));

    it("THE SAIFUR CASE: ambiguous OA namesake is dropped; modest, claim-consistent sources anchor the identity", () => {
      const result = reconcileIdentity({
        openalex: oa(331, ["name_partial", "ambiguous_top2"], "ambiguous"), // prolific namesake
        semanticScholar: s2(2),   // the real person
        arxiv: arxiv(5),
        crossrefWorks: crossref(3),
        dblp: dblp(62),           // namesake CS record — dwarfs the claim
        nsfGrants: [{ id: "g", title: "t", piName: "Saifur Rahman", agency: "nsf" as const, sourceUrl: "https://nsf", confidence: 0.8 }],
        declaredField: "agricultural extension", // → "other"
        claimedPublicationCount: 3,
      });

      // Rescued: anchored on the modest converging sources, NOT the namesake.
      expect(result.anchor).toBe("medium");
      expect(result.basis).toBe("sources_only");
      expect(result.agreeingSources).toEqual(
        expect.arrayContaining(["semantic_scholar", "arxiv", "crossref"]),
      );
      // The inflated namesake records are dropped, never credited.
      expect(result.verdicts.dblp).toBe("unconfirmed");
      expect(result.verdicts.nsf).toBe("unconfirmed");
    });

    it("THE GUARD HOLDS: a namesake grab-bag that DWARFS the claim is NOT rescued", () => {
      const result = reconcileIdentity({
        openalex: oa(85, ["name_partial", "ambiguous_top2"], "ambiguous"),
        semanticScholar: s2(53),  // 53 >> claim
        dblp: dblp(60),
        declaredField: "internal medicine", // → biomed (dblp = field_mismatch)
        claimedPublicationCount: 8,
      });

      // Only inflated records → none are claim-consistent → no rescue.
      expect(result.anchor).toBe("low");
      expect(result.basis).toBe("openalex_ambiguous");
    });

    it("does NOT rescue when fewer than 2 sources are claim-consistent", () => {
      const result = reconcileIdentity({
        openalex: oa(331, [], "ambiguous"),
        semanticScholar: s2(2), // only ONE consistent source
        dblp: dblp(62),         // dwarfs claim → excluded
        declaredField: "agricultural extension",
        claimedPublicationCount: 3,
      });

      expect(result.anchor).toBe("low");
    });

    it("does NOT rescue when the applicant gave no publication count to bound scale", () => {
      const result = reconcileIdentity({
        openalex: oa(331, [], "ambiguous"),
        semanticScholar: s2(2),
        arxiv: arxiv(5),
        crossrefWorks: crossref(3),
        declaredField: "agricultural extension",
        // no claimedPublicationCount
      });

      expect(result.anchor).toBe("low");
    });
  });
});
