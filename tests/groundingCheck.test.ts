import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/lmstudio", () => ({
  complete: vi.fn(),
  completeStructured: vi.fn(),
}));

import { runGroundingCheck, runBriefGroundingCheck, runDeterministicPrePass, type GroundingContext } from "@/lib/groundingCheck";
import { complete, completeStructured } from "@/lib/lmstudio";

const mockComplete = vi.mocked(complete);
const mockCompleteStructured = vi.mocked(completeStructured);

const baseContext: GroundingContext = {
  qualifications: {
    publications: [
      { title: "Paper A", venue: "Nature", citations: 100, impactFactor: 42 },
      { title: "Paper B", venue: "Science", citations: 50 },
    ],
    awards: [{ name: "Best Paper", issuer: "NeurIPS" }],
    grants: [{ title: "Grant 1", funder: "NSF", amount: 500000 }],
    editorialRoles: [{ journal: "JMLR" }],
  },
  endeavor: {
    endeavorField: "AI",
    nstcCategories: ["Artificial Intelligence"],
    federalPrograms: [{ programName: "NIH Bridge2AI", agencyOrOffice: "NIH" }],
    endeavorStatement: "Advancing AI for healthcare",
  },
  recommenders: [
    { name: "Dr. Smith", title: "Professor", institution: "MIT", department: "CSAIL" },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("runGroundingCheck", () => {
  it("returns empty array when draft has no issues", async () => {
    mockComplete.mockResolvedValue('{"flags": []}');
    // No numeric claims or recommender names — deterministic pass returns nothing
    const flags = await runGroundingCheck("This research addresses critical national priorities.", baseContext);
    expect(flags).toEqual([]);
  });

  it("returns flags when hallucinations detected", async () => {
    mockComplete.mockResolvedValue(JSON.stringify({
      flags: [
        { text: "Journal of Fake Science", reason: "Not in publications list", severity: "error" },
      ],
    }));
    const flags = await runGroundingCheck("Published in Journal of Fake Science.", baseContext);
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("error");
    expect(flags[0].text).toContain("Fake Science");
  });

  it("returns sentinel error flag on LLM failure (fail-closed)", async () => {
    mockComplete.mockRejectedValue(new Error("API timeout"));
    const flags = await runGroundingCheck("Any draft text.", baseContext);
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("error");
    expect(flags[0].text).toContain("audit unavailable");
  });

  it("returns sentinel error flag on malformed LLM response (fail-closed)", async () => {
    mockComplete.mockResolvedValue("not valid json at all");
    const flags = await runGroundingCheck("Any draft text.", baseContext);
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("error");
    expect(flags[0].text).toContain("audit parse error");
  });

  it("handles empty context gracefully", async () => {
    mockComplete.mockResolvedValue('{"flags": []}');
    const flags = await runGroundingCheck("Draft text.", {});
    expect(flags).toEqual([]);
    expect(mockComplete).toHaveBeenCalledOnce();
  });

  it("supports legacy call signature (plain qualifications object)", async () => {
    mockComplete.mockResolvedValue('{"flags": []}');
    const flags = await runGroundingCheck("Draft text.", {
      publications: [{ title: "Test Paper" }],
    });
    expect(flags).toEqual([]);
    expect(mockComplete).toHaveBeenCalledOnce();
  });
});

describe("runDeterministicPrePass", () => {
  const ctx: GroundingContext = {
    qualifications: {
      publications: [
        { title: "Paper A", citations: 100 },
        { title: "Paper B", citations: 50 },
      ],
      awards: [{ name: "Best Paper Award", issuer: "NeurIPS" }],
      grants: [{ title: "Grant 1", funder: "NSF", amount: 500_000 }],
    },
    recommenders: [
      { name: "Alice Smith", title: "Professor", institution: "MIT" },
    ],
  };

  it("flags wrong citation count in draft", () => {
    const flags = runDeterministicPrePass("The applicant has received 999 citations.", ctx);
    expect(flags.some(f => f.text.includes("999 citation") && f.severity === "error")).toBe(true);
  });

  it("passes correct total citation count", () => {
    const flags = runDeterministicPrePass("The applicant has received 150 citations in total.", ctx);
    expect(flags.filter(f => f.reason.includes("Citation count"))).toHaveLength(0);
  });

  it("passes per-publication citation count", () => {
    const flags = runDeterministicPrePass("Paper A has 100 citations.", ctx);
    expect(flags.filter(f => f.reason.includes("Citation count"))).toHaveLength(0);
  });

  it("flags wrong publication count", () => {
    const flags = runDeterministicPrePass("The applicant has published 7 papers.", ctx);
    expect(flags.some(f => f.reason.includes("Publication count") && f.severity === "error")).toBe(true);
  });

  it("passes correct publication count", () => {
    const flags = runDeterministicPrePass("The applicant has published 2 papers.", ctx);
    expect(flags.filter(f => f.reason.includes("Publication count"))).toHaveLength(0);
  });

  it("flags wrong grant amount", () => {
    const flags = runDeterministicPrePass("The $1,200,000 NSF grant funds this research.", ctx);
    expect(flags.some(f => f.reason.includes("Amount") && f.severity === "warning")).toBe(true);
  });

  it("passes correct grant amount", () => {
    const flags = runDeterministicPrePass("The $500,000 NSF grant funds this research.", ctx);
    expect(flags.filter(f => f.reason.includes("Amount"))).toHaveLength(0);
  });

  it("flags invented award name", () => {
    const flags = runDeterministicPrePass("The applicant received the Imaginary Excellence Award.", ctx);
    expect(flags.some(f => f.reason.includes("not found in evidence") && f.text.includes("Award"))).toBe(true);
  });

  it("passes known award name", () => {
    const flags = runDeterministicPrePass("The applicant received the Best Paper Award.", ctx);
    expect(flags.filter(f => f.reason.includes("Honor"))).toHaveLength(0);
  });

  it("flags recommender not in list", () => {
    const flags = runDeterministicPrePass("As Dr. Johnson noted in the reference letter.", ctx);
    expect(flags.some(f => f.reason.includes("recommender list"))).toBe(true);
  });

  it("passes known recommender name", () => {
    const flags = runDeterministicPrePass("As Prof. Smith noted in the reference letter.", ctx);
    expect(flags.filter(f => f.reason.includes("recommender list"))).toHaveLength(0);
  });

  it("returns empty array for draft with no checkable claims", () => {
    const flags = runDeterministicPrePass("This research is of national importance.", ctx);
    expect(flags).toHaveLength(0);
  });

  it("deterministic flags survive LLM outage (prepended to sentinel)", async () => {
    mockComplete.mockRejectedValue(new Error("LLM down"));
    const flags = await runGroundingCheck(
      "The applicant has 999 citations and received the Imaginary Excellence Award.",
      ctx,
    );
    // Deterministic flags come first, sentinel at end
    expect(flags.some(f => f.reason.includes("Citation count"))).toBe(true);
    expect(flags.some(f => f.text.includes("[audit unavailable]"))).toBe(true);
  });
});

describe("runBriefGroundingCheck", () => {
  const brief = {
    substantialMerit: "SM section text",
    nationalImportance: "NI section text",
    waiverJustification: "WJ section text",
  };

  it("runs grounding check on all 3 sections + credibility in parallel", async () => {
    mockComplete.mockResolvedValue('{"flags": []}');
    mockCompleteStructured.mockResolvedValue({ score: 85, notes: "Strong draft" });

    const report = await runBriefGroundingCheck(brief, baseContext);

    // 3 grounding checks + 1 credibility = 4 LLM calls
    expect(mockComplete).toHaveBeenCalledTimes(3);
    expect(mockCompleteStructured).toHaveBeenCalledOnce();
    expect(report.flags.substantialMerit).toEqual([]);
    expect(report.flags.nationalImportance).toEqual([]);
    expect(report.flags.waiverJustification).toEqual([]);
    expect(report.partnerCredibilityScore).toBe(85);
    expect(report.credibilityNotes).toBe("Strong draft");
  });

  it("clamps credibility score to 0-100", async () => {
    mockComplete.mockResolvedValue('{"flags": []}');
    mockCompleteStructured.mockResolvedValue({ score: 150, notes: "Over" });

    const report = await runBriefGroundingCheck(brief, baseContext);
    expect(report.partnerCredibilityScore).toBe(100);
  });

  it("returns 0 credibility score on LLM failure", async () => {
    mockComplete.mockResolvedValue('{"flags": []}');
    mockCompleteStructured.mockRejectedValue(new Error("API down"));

    const report = await runBriefGroundingCheck(brief, baseContext);
    expect(report.partnerCredibilityScore).toBe(0);
    expect(report.credibilityNotes).toContain("unavailable");
  });

  it("collects flags from different sections independently", async () => {
    let callCount = 0;
    mockComplete.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return JSON.stringify({ flags: [{ text: "SM issue", reason: "test", severity: "warning" }] });
      }
      return '{"flags": []}';
    });
    mockCompleteStructured.mockResolvedValue({ score: 70, notes: "OK" });

    const report = await runBriefGroundingCheck(brief, baseContext);
    expect(report.flags.substantialMerit).toHaveLength(1);
    expect(report.flags.nationalImportance).toHaveLength(0);
    expect(report.flags.waiverJustification).toHaveLength(0);
  });
});
