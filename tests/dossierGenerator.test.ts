import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies before imports
vi.mock("@/lib/lmstudio", () => ({
  complete: vi.fn(),
  completeStructured: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  readCase: vi.fn(),
}));

vi.mock("@/lib/drafting", () => ({
  extractEvidence: vi.fn(),
  // Default: pass formData through unchanged (the null-ledger contract). Tests
  // that exercise curation can override this mock per-case.
  filterFormDataByLedger: vi.fn((fd: Record<string, unknown>) => fd),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@/lib/exhibitPlan", () => ({
  buildExhibitRows: vi.fn(),
  exhibitRowsToMarkdown: vi.fn(),
}));

vi.mock("@/lib/groundingCheck", () => ({
  runBriefGroundingCheck: vi.fn(),
}));

import { buildNarrativeSkeleton, generateDossier, type NarrativeSkeleton } from "@/lib/dossierGenerator";
import { complete, completeStructured } from "@/lib/lmstudio";
import { readCase } from "@/lib/db";
import { extractEvidence, type EvidenceAtom } from "@/lib/drafting";
import { buildExhibitRows, exhibitRowsToMarkdown } from "@/lib/exhibitPlan";
import { runBriefGroundingCheck } from "@/lib/groundingCheck";

const mockComplete = vi.mocked(complete);
const mockCompleteStructured = vi.mocked(completeStructured);
const mockReadCase = vi.mocked(readCase);
const mockExtractEvidence = vi.mocked(extractEvidence);
const mockBuildExhibitRows = vi.mocked(buildExhibitRows);
const mockExhibitRowsToMarkdown = vi.mocked(exhibitRowsToMarkdown);
const mockRunBriefGroundingCheck = vi.mocked(runBriefGroundingCheck);

const sampleAtoms: EvidenceAtom[] = [
  { id: "pub-0", kind: "publication", summary: "Paper A", metric: "100 citations", year: 2022 },
  { id: "pub-1", kind: "publication", summary: "Paper B", metric: "50 citations", year: 2023 },
  { id: "grant-0", kind: "grant", summary: "NSF Grant", metric: "PI", year: 2023 },
  { id: "award-0", kind: "award", summary: "Best Paper Award", year: 2022 },
  { id: "role-0", kind: "role", summary: "JMLR Reviewer", year: 2024 },
];

const endeavorContext = {
  field: "AI",
  endeavorStatement: "Advancing AI for healthcare",
  nstcCategories: ["Artificial Intelligence"],
  federalPrograms: ["NIH Bridge2AI — NIH"],
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// buildNarrativeSkeleton
// ---------------------------------------------------------------------------

describe("buildNarrativeSkeleton", () => {
  it("returns empty arrays when no atoms provided", async () => {
    const skeleton = await buildNarrativeSkeleton([], endeavorContext);
    expect(skeleton).toEqual({
      substantialMerit: [],
      nationalImportance: [],
      waiverJustification: [],
    });
    // Should NOT call LLM when atoms are empty
    expect(mockCompleteStructured).not.toHaveBeenCalled();
  });

  it("filters invalid atom IDs from LLM response", async () => {
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: ["pub-0", "FAKE-ID", "pub-1"],
      nationalImportance: ["grant-0", "NONEXISTENT"],
      waiverJustification: ["award-0", "role-0", "GHOST"],
    } as NarrativeSkeleton);

    const skeleton = await buildNarrativeSkeleton(sampleAtoms, endeavorContext);
    expect(skeleton.substantialMerit).toEqual(["pub-0", "pub-1"]);
    expect(skeleton.nationalImportance).toEqual(["grant-0"]);
    expect(skeleton.waiverJustification).toEqual(["award-0", "role-0"]);
  });

  it("returns empty on LLM failure (graceful degradation)", async () => {
    mockCompleteStructured.mockRejectedValue(new Error("LLM timeout"));
    const skeleton = await buildNarrativeSkeleton(sampleAtoms, endeavorContext);
    expect(skeleton).toEqual({
      substantialMerit: [],
      nationalImportance: [],
      waiverJustification: [],
    });
  });

  it("passes atoms and context to LLM call", async () => {
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: ["pub-0"],
      nationalImportance: ["grant-0"],
      waiverJustification: ["role-0"],
    } as NarrativeSkeleton);

    await buildNarrativeSkeleton(sampleAtoms, endeavorContext);
    expect(mockCompleteStructured).toHaveBeenCalledOnce();

    const callArgs = mockCompleteStructured.mock.calls[0];
    const messages = callArgs[0];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    // User message should contain atom IDs and endeavor context
    expect(messages[1].content).toContain("pub-0");
    expect(messages[1].content).toContain("FIELD: AI");
    expect(messages[1].content).toContain("Advancing AI for healthcare");
  });

  it("uses fast tier with temperature 0", async () => {
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: [],
      nationalImportance: [],
      waiverJustification: [],
    } as NarrativeSkeleton);

    await buildNarrativeSkeleton(sampleAtoms, endeavorContext);
    const opts = mockCompleteStructured.mock.calls[0][1];
    expect(opts).toMatchObject({ tier: "fast", temperature: 0 });
  });

  it("handles missing prong arrays in LLM response", async () => {
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: ["pub-0"],
      // nationalImportance and waiverJustification omitted
    } as unknown as NarrativeSkeleton);

    const skeleton = await buildNarrativeSkeleton(sampleAtoms, endeavorContext);
    expect(skeleton.substantialMerit).toEqual(["pub-0"]);
    expect(skeleton.nationalImportance).toEqual([]);
    expect(skeleton.waiverJustification).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// generateDossier (full pipeline)
// ---------------------------------------------------------------------------

describe("generateDossier", () => {
  const mockCase = {
    id: "case-1",
    formData: {
      petitionerInfo: { givenName: "Yuki", familyName: "Tanaka" },
      qualifications: {
        publications: [
          { title: "Paper A", venue: "Nature", citations: 100 },
        ],
        awards: [{ name: "Best Paper" }],
      },
      endeavor: {
        endeavorField: "AI",
        endeavorStatement: "Advancing AI",
        nstcCategories: ["Artificial Intelligence"],
        federalPrograms: [{ programName: "NIH Bridge2AI", agencyOrOffice: "NIH" }],
      },
      recommenders: [{ name: "Dr. Smith", title: "Professor", institution: "MIT" }],
    },
    letters: {},
  };

  function setupMocks() {
    mockReadCase.mockResolvedValue(mockCase as unknown as Awaited<ReturnType<typeof readCase>>);
    mockExtractEvidence.mockReturnValue(sampleAtoms);
    mockBuildExhibitRows.mockReturnValue([
      { prong: "Prong 1", item: "Test Exhibit", description: "Test desc" },
    ]);
    mockExhibitRowsToMarkdown.mockReturnValue("| Prong | Item | Description |");

    // Skeleton returns valid IDs
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: ["pub-0"],
      nationalImportance: ["grant-0"],
      waiverJustification: ["role-0"],
    } as NarrativeSkeleton);

    // Section generators return section text
    mockComplete
      .mockResolvedValueOnce("Substantial merit section text.")
      .mockResolvedValueOnce("National importance section text.")
      .mockResolvedValueOnce("Waiver justification section text.");

    mockRunBriefGroundingCheck.mockResolvedValue({
      flags: {
        substantialMerit: [],
        nationalImportance: [],
        waiverJustification: [],
      },
      partnerCredibilityScore: 85,
      credibilityNotes: "Strong draft",
    });
  }

  it("throws when case not found", async () => {
    mockReadCase.mockResolvedValue(null as never);
    await expect(generateDossier("bad-id", "tier1", 90)).rejects.toThrow("not found");
  });

  it("returns complete DossierData shape", async () => {
    setupMocks();
    const result = await generateDossier("case-1", "tier1", 90);

    expect(result.caseId).toBe("case-1");
    expect(result.field).toBe("AI");
    expect(result.tier).toBe("tier1");
    expect(result.score).toBe(90);
    expect(result.applicantName).toBe("Yuki Tanaka");
    expect(result.brief.substantialMerit).toBe("Substantial merit section text.");
    expect(result.brief.nationalImportance).toBe("National importance section text.");
    expect(result.brief.waiverJustification).toBe("Waiver justification section text.");
    expect(result.qualityReport.partnerCredibilityScore).toBe(85);
    // Backward compat field
    expect(result.prong1Draft).toBe(result.brief.substantialMerit);
  });

  it("runs skeleton → sections → grounding in order", async () => {
    setupMocks();
    await generateDossier("case-1", "tier1", 90);

    // Skeleton (completeStructured) called first
    expect(mockCompleteStructured).toHaveBeenCalledOnce();
    // Then 3 section generators (complete) called
    expect(mockComplete).toHaveBeenCalledTimes(3);
    // Then grounding check
    expect(mockRunBriefGroundingCheck).toHaveBeenCalledOnce();
  });

  it("falls back to all evidence when skeleton returns empty", async () => {
    setupMocks();
    // Override skeleton to return empty
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: [],
      nationalImportance: [],
      waiverJustification: [],
    } as NarrativeSkeleton);

    await generateDossier("case-1", "tier1", 90);

    // Section generators should still be called (with all evidence as fallback)
    expect(mockComplete).toHaveBeenCalledTimes(3);
  });

  it("passes grounding context with qualifications and recommenders", async () => {
    setupMocks();
    await generateDossier("case-1", "tier1", 90);

    const groundingCall = mockRunBriefGroundingCheck.mock.calls[0];
    const brief = groundingCall[0];
    const ctx = groundingCall[1];
    expect(brief).toHaveProperty("substantialMerit");
    expect(brief).toHaveProperty("nationalImportance");
    expect(brief).toHaveProperty("waiverJustification");
    expect(ctx).toHaveProperty("qualifications");
    expect(ctx).toHaveProperty("recommenders");
  });

  it("handles null score", async () => {
    setupMocks();
    const result = await generateDossier("case-1", "tier2", null);
    expect(result.score).toBeNull();
  });

  it("extracts applicant name from petitionerInfo", async () => {
    setupMocks();
    const result = await generateDossier("case-1", "tier1", 90);
    expect(result.applicantName).toBe("Yuki Tanaka");
  });

  it("defaults applicant name to 'Applicant' when missing", async () => {
    const noNameCase = {
      ...mockCase,
      formData: {
        ...mockCase.formData,
        petitionerInfo: {},
      },
    };
    mockReadCase.mockResolvedValue(noNameCase as unknown as Awaited<ReturnType<typeof readCase>>);
    mockExtractEvidence.mockReturnValue([]);
    mockBuildExhibitRows.mockReturnValue([]);
    mockExhibitRowsToMarkdown.mockReturnValue("");
    mockCompleteStructured.mockResolvedValue({
      substantialMerit: [],
      nationalImportance: [],
      waiverJustification: [],
    } as NarrativeSkeleton);
    mockComplete.mockResolvedValue("Section text.");
    mockRunBriefGroundingCheck.mockResolvedValue({
      flags: { substantialMerit: [], nationalImportance: [], waiverJustification: [] },
      partnerCredibilityScore: 0,
      credibilityNotes: "",
    });

    const result = await generateDossier("case-1", "tier3", null);
    expect(result.applicantName).toBe("Applicant");
  });
});
