import { describe, it, expect } from "vitest";
import {
  tierFor,
  TIER_THRESHOLDS,
  TIER_META,
  legacyTierToCanonical,
  canonicalToLegacyTier,
  resolveTier,
  letterQualityFor,
  LETTER_QUALITY_THRESHOLDS,
  evidenceCeiling,
  clampScoreToEvidence,
  resolveCandidateScore,
  scoreFromDimensions,
  DIMENSION_WEIGHTS,
  type Tier,
} from "@/lib/scoring";
import { isPlausibleResearchField } from "@/lib/checkValidation";

describe("scoreFromDimensions (R-3 — deterministic, server-side)", () => {
  it("weights the 5 dimensions in order and rounds", () => {
    // 90*.15 + 78*.25 + 65*.20 + 70*.25 + 65*.15 = 13.5+19.5+13+17.5+9.75 = 73.25 → 73
    const dims = [{ score: 90 }, { score: 78 }, { score: 65 }, { score: 70 }, { score: 65 }];
    expect(scoreFromDimensions(dims)).toBe(73);
  });

  it("all-100 dimensions → 100", () => {
    expect(scoreFromDimensions([100, 100, 100, 100, 100].map((s) => ({ score: s })))).toBe(100);
  });

  it("returns null when not exactly 5 dimensions", () => {
    expect(scoreFromDimensions([{ score: 80 }])).toBeNull();
    expect(scoreFromDimensions([])).toBeNull();
    expect(scoreFromDimensions(null)).toBeNull();
    expect(scoreFromDimensions(undefined)).toBeNull();
  });

  it("tolerates missing/NaN dimension scores (treats as 0)", () => {
    const dims = [{ score: 100 }, { score: NaN as unknown as number }, {}, { score: 0 }, { score: 0 }] as { score: number }[];
    // only the first weight (0.15) contributes → 15
    expect(scoreFromDimensions(dims)).toBe(15);
  });

  it("weights sum to 1", () => {
    expect(DIMENSION_WEIGHTS.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });
});

describe("isPlausibleResearchField (G-3)", () => {
  it("rejects pure-numeric / symbol / empty garbage", () => {
    for (const v of ["18", "2", "", "   ", "1", "$$", "9.5", null, undefined]) {
      expect(isPlausibleResearchField(v as string)).toBe(false);
    }
  });

  it("accepts real fields, including short and non-Latin", () => {
    for (const v of ["AI", "ML", "CS", "Machine Learning", "Oncology", "M&A", "الذكاء الاصطناعي", "机器学习"]) {
      expect(isPlausibleResearchField(v)).toBe(true);
    }
  });

  it("requires at least two letters (single letter rejected)", () => {
    expect(isPlausibleResearchField("a")).toBe(false);
    expect(isPlausibleResearchField("1a")).toBe(false);
    expect(isPlausibleResearchField("ab")).toBe(true);
  });
});

describe("tierFor", () => {
  it("returns strong for scores >= 75", () => {
    expect(tierFor(75)).toBe("strong");
    expect(tierFor(100)).toBe("strong");
    expect(tierFor(99)).toBe("strong");
  });

  it("returns developing for scores 50-74", () => {
    expect(tierFor(50)).toBe("developing");
    expect(tierFor(74)).toBe("developing");
    expect(tierFor(60)).toBe("developing");
  });

  it("returns early for scores below 50", () => {
    expect(tierFor(49)).toBe("early");
    expect(tierFor(0)).toBe("early");
    expect(tierFor(1)).toBe("early");
  });

  it("boundary: 75 is strong, 74 is developing", () => {
    expect(tierFor(75)).toBe("strong");
    expect(tierFor(74)).toBe("developing");
  });

  it("boundary: 50 is developing, 49 is early", () => {
    expect(tierFor(50)).toBe("developing");
    expect(tierFor(49)).toBe("early");
  });
});

describe("TIER_THRESHOLDS", () => {
  it("has expected values", () => {
    expect(TIER_THRESHOLDS.strong).toBe(75);
    expect(TIER_THRESHOLDS.developing).toBe(50);
  });
});

describe("TIER_META", () => {
  it("has entries for all tiers", () => {
    const tiers: Tier[] = ["strong", "developing", "early"];
    for (const t of tiers) {
      expect(TIER_META[t]).toBeDefined();
      expect(TIER_META[t].label).toBeTruthy();
      expect(TIER_META[t].longLabel).toBeTruthy();
      expect(TIER_META[t].statusToken).toBeTruthy();
      expect(TIER_META[t].description).toBeTruthy();
    }
  });

  it("score-band ranges stay in sync with TIER_THRESHOLDS (R-1)", () => {
    expect(TIER_META.strong.range).toBe(`${TIER_THRESHOLDS.strong}–100`);
    expect(TIER_META.developing.range).toBe(
      `${TIER_THRESHOLDS.developing}–${TIER_THRESHOLDS.strong - 1}`
    );
    expect(TIER_META.early.range).toBe(`0–${TIER_THRESHOLDS.developing - 1}`);
  });

  it("strong has success status token", () => {
    expect(TIER_META.strong.statusToken).toBe("success");
  });

  it("developing has warning status token", () => {
    expect(TIER_META.developing.statusToken).toBe("warning");
  });

  it("early has neutral status token", () => {
    expect(TIER_META.early.statusToken).toBe("neutral");
  });
});

describe("legacyTierToCanonical", () => {
  it("maps tier1 to strong", () => {
    expect(legacyTierToCanonical("tier1")).toBe("strong");
  });

  it("maps tier2 to developing", () => {
    expect(legacyTierToCanonical("tier2")).toBe("developing");
  });

  it("maps tier3 to early", () => {
    expect(legacyTierToCanonical("tier3")).toBe("early");
  });

  it("maps null/undefined to early", () => {
    expect(legacyTierToCanonical(null)).toBe("early");
    expect(legacyTierToCanonical(undefined)).toBe("early");
  });

  it("maps unknown strings to early", () => {
    expect(legacyTierToCanonical("invalid")).toBe("early");
    expect(legacyTierToCanonical("")).toBe("early");
  });
});

describe("canonicalToLegacyTier", () => {
  it("round-trips with legacyTierToCanonical", () => {
    expect(canonicalToLegacyTier(legacyTierToCanonical("tier1"))).toBe("tier1");
    expect(canonicalToLegacyTier(legacyTierToCanonical("tier2"))).toBe("tier2");
    expect(canonicalToLegacyTier(legacyTierToCanonical("tier3"))).toBe("tier3");
  });

  it("maps canonical tiers to legacy strings", () => {
    expect(canonicalToLegacyTier("strong")).toBe("tier1");
    expect(canonicalToLegacyTier("developing")).toBe("tier2");
    expect(canonicalToLegacyTier("early")).toBe("tier3");
  });
});

describe("resolveTier", () => {
  it("resolves numbers via tierFor", () => {
    expect(resolveTier(80)).toBe("strong");
    expect(resolveTier(60)).toBe("developing");
    expect(resolveTier(30)).toBe("early");
  });

  it("resolves legacy strings", () => {
    expect(resolveTier("tier1")).toBe("strong");
    expect(resolveTier("tier2")).toBe("developing");
    expect(resolveTier("tier3")).toBe("early");
  });

  it("resolves canonical strings", () => {
    expect(resolveTier("strong")).toBe("strong");
    expect(resolveTier("developing")).toBe("developing");
    expect(resolveTier("early")).toBe("early");
  });

  it("resolves display labels", () => {
    expect(resolveTier("Strong")).toBe("strong");
    expect(resolveTier("Developing")).toBe("developing");
    expect(resolveTier("Early")).toBe("early");
  });

  it("resolves old labels for backward compat", () => {
    expect(resolveTier("Borderline")).toBe("developing");
    expect(resolveTier("Weak")).toBe("early");
  });

  it("returns early for null/undefined", () => {
    expect(resolveTier(null)).toBe("early");
    expect(resolveTier(undefined)).toBe("early");
  });
});

describe("letterQualityFor", () => {
  it("returns excellent for scores >= 85", () => {
    expect(letterQualityFor(85)).toBe("excellent");
    expect(letterQualityFor(100)).toBe("excellent");
  });

  it("returns acceptable for scores 70-84", () => {
    expect(letterQualityFor(70)).toBe("acceptable");
    expect(letterQualityFor(84)).toBe("acceptable");
  });

  it("returns needs-work for scores below 70", () => {
    expect(letterQualityFor(69)).toBe("needs-work");
    expect(letterQualityFor(0)).toBe("needs-work");
  });

  it("boundary: 85 is excellent, 84 is acceptable", () => {
    expect(letterQualityFor(LETTER_QUALITY_THRESHOLDS.excellent)).toBe("excellent");
    expect(letterQualityFor(LETTER_QUALITY_THRESHOLDS.excellent - 1)).toBe("acceptable");
  });

  it("boundary: 70 is acceptable, 69 is needs-work", () => {
    expect(letterQualityFor(LETTER_QUALITY_THRESHOLDS.acceptable)).toBe("acceptable");
    expect(letterQualityFor(LETTER_QUALITY_THRESHOLDS.acceptable - 1)).toBe("needs-work");
  });
});

describe("evidenceCeiling", () => {
  it("clamps a totally empty / fake profile to early (35)", () => {
    // The exact bug the founder hit: no name, no papers, no citations → must
    // never read as Strong. 35 is below the developing threshold (50) AND the
    // preliminary "Promising" floor (40), so it reads as Early Stage.
    const ceil = evidenceCeiling({ publications: "None", citations: "None or unknown" });
    expect(ceil).toBe(35);
    expect(tierFor(ceil)).toBe("early");
  });

  it("clamps a blank/missing profile the same way", () => {
    expect(evidenceCeiling({})).toBe(35);
    expect(evidenceCeiling({ publications: "", citations: "" })).toBe(35);
  });

  it("does not penalize a strong publication record with unknown citations", () => {
    // Real researchers often don't know their citation count and pick
    // "None or unknown" — the MAX rule must not drag them down.
    const ceil = evidenceCeiling({ publications: "11–25", citations: "None or unknown" });
    expect(ceil).toBe(92);
    expect(tierFor(ceil)).toBe("strong");
  });

  it("lets a heavily cited author through even with few listed papers", () => {
    const ceil = evidenceCeiling({ publications: "1–3", citations: "More than 500" });
    expect(ceil).toBe(100);
  });

  it("never caps an elite profile", () => {
    expect(evidenceCeiling({ publications: "More than 25", citations: "201–500" })).toBe(100);
  });

  it("keeps a thin (1–3 pubs) profile out of strong territory", () => {
    const ceil = evidenceCeiling({ publications: "1–3", citations: "1–50" });
    expect(tierFor(ceil)).not.toBe("strong");
  });

  it("lifts an empty research record only for standout secondary evidence", () => {
    // National/international award or large grant = exceptional-ability path.
    expect(evidenceCeiling({ publications: "None", citations: "None or unknown", awards: "National award or prize" })).toBe(80);
    expect(evidenceCeiling({ publications: "None", citations: "None or unknown", grants: "Large grant (over $500K)" })).toBe(85);
    // An institutional award is NOT enough to escape the empty-profile clamp.
    expect(evidenceCeiling({ publications: "None", citations: "None or unknown", awards: "Institutional award (department, university)" })).toBe(35);
  });

  it("is a ceiling, not a floor — never returns above 100", () => {
    expect(evidenceCeiling({ publications: "More than 25", citations: "More than 500" })).toBeLessThanOrEqual(100);
  });
});

describe("clampScoreToEvidence", () => {
  const EMPTY = { publications: "None", citations: "None or unknown" };
  const STRONG = { publications: "More than 25", citations: "More than 500" };

  it("clamps an inflated score for an empty profile down to the ceiling", () => {
    // The downstream guarantee: even if a fabricated/legacy 95 is handed to the
    // dossier, it can never render above the evidence ceiling.
    expect(clampScoreToEvidence(95, EMPTY)).toBe(35);
    expect(clampScoreToEvidence(100, EMPTY)).toBe(35);
  });

  it("leaves a legitimate score untouched when below the ceiling", () => {
    expect(clampScoreToEvidence(50, { publications: "4–10", citations: "1–50" })).toBe(50);
    expect(clampScoreToEvidence(88, STRONG)).toBe(88);
  });

  it("passes null/undefined scores through unchanged", () => {
    expect(clampScoreToEvidence(null, EMPTY)).toBeNull();
    expect(clampScoreToEvidence(undefined, EMPTY)).toBeUndefined();
  });

  it("does NOT clamp when there is no publication/citation signal", () => {
    // Critical: an answer-less reassess (formData {}) must not nuke a real score.
    expect(clampScoreToEvidence(82, {})).toBe(82);
    expect(clampScoreToEvidence(82, { _summary: "x", _dimensions: [] })).toBe(82);
    expect(clampScoreToEvidence(82, undefined)).toBe(82);
  });

  it("ignores non-string answer values defensively", () => {
    expect(clampScoreToEvidence(90, { publications: 3, citations: null })).toBe(90);
  });
});

describe("resolveCandidateScore", () => {
  it("returns clamped score + a tier derived from the clamped value", () => {
    const r = resolveCandidateScore(95, { publications: "None", citations: "None or unknown" });
    expect(r.score).toBe(35);
    expect(r.tier).toBe("tier3"); // early — never tier1 for an empty profile
  });

  it("keeps a strong, evidence-backed pair intact", () => {
    const r = resolveCandidateScore(88, { publications: "More than 25", citations: "More than 500" });
    expect(r.score).toBe(88);
    expect(r.tier).toBe("tier1");
  });

  it("falls back to the provided tier when score is null", () => {
    expect(resolveCandidateScore(null, {}, "tier2")).toEqual({ score: null, tier: "tier2" });
  });

  it("score and tier never disagree (no strong tier on a clamped-to-early score)", () => {
    const r = resolveCandidateScore(99, { publications: "None", citations: "None or unknown" });
    expect(tierFor(r.score!)).toBe("early");
    expect(r.tier).toBe("tier3");
  });
});
