/**
 * Adversarial eval harness for the grounding check deterministic pre-pass.
 * 20 fixture pairs — each seeds a specific fabrication (or correct claim) and
 * asserts the pre-pass either catches it or leaves it alone.
 *
 * All fixtures target runDeterministicPrePass() so the suite runs in <200ms
 * with no LLM cost and no network. LLM-layer hallucinations (invented journal
 * names, wrong NSTC categories) are caught by the LLM itself and are not
 * tested here.
 */
import { describe, it, expect } from "vitest";
import { runDeterministicPrePass, type GroundingContext } from "@/lib/groundingCheck";

// ── Shared evidence fixtures ──────────────────────────────────────────────────

const BASE_CTX: GroundingContext = {
  qualifications: {
    publications: [
      { title: "Deep Learning for Climate", venue: "Nature", citations: 320 },
      { title: "Protein Folding at Scale",  venue: "Science", citations: 85 },
      { title: "Quantum Error Correction",  venue: "PRL",    citations: 47 },
    ],
    awards: [
      { name: "NSF CAREER Award", issuer: "NSF" },
      { name: "Best Paper Prize", issuer: "ICML" },
    ],
    grants: [
      { title: "AI for Climate", funder: "NSF",  amount: 750_000 },
      { title: "Quantum Bridge",  funder: "DARPA", amount: 1_200_000 },
    ],
  },
  recommenders: [
    { name: "Prof. Alice Wang",   institution: "MIT" },
    { name: "Dr. Carlos Mendez",  institution: "Stanford" },
  ],
};

// Total citations: 320 + 85 + 47 = 452
// Publication count: 3

// ── Helper ────────────────────────────────────────────────────────────────────

function flags(draft: string, ctx: GroundingContext = BASE_CTX) {
  return runDeterministicPrePass(draft, ctx);
}
function flagTexts(draft: string, ctx: GroundingContext = BASE_CTX) {
  return flags(draft, ctx).map(f => f.text + " | " + f.reason);
}
function hasFlag(draft: string, keyword: string, ctx: GroundingContext = BASE_CTX) {
  return flagTexts(draft, ctx).some(t => t.toLowerCase().includes(keyword.toLowerCase()));
}
function noFlags(draft: string, ctx: GroundingContext = BASE_CTX) {
  return flags(draft, ctx).length === 0;
}

// ── Citation count fixtures (1–6) ─────────────────────────────────────────────

describe("adversarial: citation counts", () => {
  it("F01 — citation count 2× inflated (999 vs 452)", () => {
    expect(hasFlag("The applicant has received 999 citations.", "Citation count 999")).toBe(true);
  });

  it("F02 — citation count 3× inflated (1500 vs 452)", () => {
    expect(hasFlag("Over 1,500 citations demonstrate wide impact.", "Citation count 1500")).toBe(true);
  });

  it("F03 — citation count deflated (10 vs 452)", () => {
    expect(hasFlag("With 10 citations, the work has growing recognition.", "Citation count 10")).toBe(true);
  });

  it("F04 — per-publication citation count correct (320 — exact match)", () => {
    expect(noFlags("Paper A has received 320 citations since publication.")).toBe(true);
  });

  it("F05 — total citation count correct (452 — exact match)", () => {
    expect(noFlags("The applicant has accumulated 452 citations across all publications.")).toBe(true);
  });

  it("F06 — approximate total within 5% tolerance (450 vs 452)", () => {
    // 450 is within 5% of 452 → should NOT flag
    expect(noFlags("Approximately 450 citations reflect wide engagement.")).toBe(true);
  });
});

// ── Publication count fixtures (7–10) ─────────────────────────────────────────

describe("adversarial: publication counts", () => {
  it("F07 — pub count inflated (10 vs 3)", () => {
    expect(hasFlag("The applicant has published 10 peer-reviewed papers.", "Publication count 10")).toBe(true);
  });

  it("F08 — pub count deflated (1 vs 3 — beyond ±1 tolerance)", () => {
    expect(hasFlag("With 1 publication, the applicant is emerging.", "Publication count 1")).toBe(true);
  });

  it("F09 — pub count correct (3 — exact match)", () => {
    expect(noFlags("Three peer-reviewed publications establish a strong record.")).toBe(true);
  });

  it("F10 — pub count ±1 (4 — in-press tolerance)", () => {
    // 4 is exactly 1 away from 3 → allowed for in-press
    expect(noFlags("The applicant has 4 publications including one in press.")).toBe(true);
  });
});

// ── Grant amount fixtures (11–13) ─────────────────────────────────────────────

describe("adversarial: grant amounts", () => {
  it("F11 — grant amount doubled ($1.5M vs $750K)", () => {
    expect(hasFlag("The $1,500,000 NSF grant funds this research.", "Amount")).toBe(true);
  });

  it("F12 — invented grant amount not in record ($250,000)", () => {
    expect(hasFlag("A $250,000 fellowship supported this work.", "Amount")).toBe(true);
  });

  it("F13 — grant amount correct ($750,000 — exact match)", () => {
    expect(noFlags("The $750,000 NSF AI for Climate grant underpins the proposed endeavor.")).toBe(true);
  });
});

// ── Award / prize name fixtures (14–16) ───────────────────────────────────────

describe("adversarial: award names", () => {
  it("F14 — invented award name (Nobel Prize — not in evidence)", () => {
    expect(hasFlag("The applicant received the Nobel Prize for this work.", "Nobel Prize")).toBe(true);
  });

  it("F15 — known award name passes (NSF CAREER Award)", () => {
    expect(noFlags("The NSF CAREER Award recognizes the applicant's early-career excellence.")).toBe(true);
  });

  it("F16 — partial name match for known award (Best Paper — substring of Best Paper Prize)", () => {
    // "Best Paper Award" — "Award" suffix matches our regex; "best paper" IS in known awards
    // The pre-pass should not flag this (known award substring match)
    const result = flags("Recipient of the Best Paper Award from ICML.");
    const awardFlags = result.filter(f => f.reason.includes("Honor"));
    expect(awardFlags).toHaveLength(0);
  });
});

// ── Recommender name fixtures (17–18) ─────────────────────────────────────────

describe("adversarial: recommender names", () => {
  it("F17 — invented recommender (Dr. Johnson — not in list)", () => {
    expect(hasFlag("As Dr. Johnson noted in the reference letter.", "recommender list")).toBe(true);
  });

  it("F18 — known recommender passes (Dr. Mendez — last name match)", () => {
    expect(noFlags("Dr. Mendez has observed the applicant's work over three years.")).toBe(true);
  });
});

// ── Multi-fabrication and clean-draft fixtures (19–20) ────────────────────────

describe("adversarial: compound and clean cases", () => {
  it("F19 — multiple fabrications in one draft (wrong citations + invented award)", () => {
    const draft = "With 999 citations and the Nobel Prize, this applicant stands out.";
    const result = flags(draft);
    // Both fabrications should be caught
    expect(result.some(f => f.reason.includes("Citation count 999"))).toBe(true);
    expect(result.some(f => f.text.includes("Nobel Prize"))).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("F20 — fully clean draft produces zero flags", () => {
    const draft =
      "This proposed endeavor addresses critical national priorities in AI and climate research. " +
      "The applicant's contributions are consistent with U.S. strategic goals as outlined in federal initiatives.";
    expect(noFlags(draft)).toBe(true);
  });
});

// ── Document-grounded claim (bonus, R4-3 integration) ────────────────────────

describe("adversarial: document-grounded claims", () => {
  it("F21 — context with empty evidence but non-empty docs produces no structural errors", () => {
    const ctx: GroundingContext = {
      qualifications: { publications: [] },
      documents: [{ name: "cv", content: "Published 5 papers in Nature and Science." }],
    };
    // No structured publications → citation/pub-count checks don't run (nothing to compare against)
    const result = runDeterministicPrePass("The applicant has 999 citations.", ctx);
    // Should produce 0 flags because allCitationCounts is empty (no pubs with citation data)
    expect(result.filter(f => f.reason.includes("Citation count"))).toHaveLength(0);
  });
});
