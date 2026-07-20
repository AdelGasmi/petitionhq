import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: { firmProfile: { findUnique: vi.fn() }, user: { findUnique: vi.fn() } },
}));

import { loadAttorneyGuidance, loadApplicantGuidance, resolveDraftingGuidance, briefSectionRuleId } from "@/lib/attorneyRules";
import { prisma } from "@/lib/prisma";

const findUnique = vi.mocked(prisma.firmProfile.findUnique);
const findUserUnique = vi.mocked(prisma.user.findUnique);

beforeEach(() => {
  findUnique.mockReset();
  findUserUnique.mockReset();
});

describe("loadAttorneyGuidance", () => {
  it("returns '' when the firm has no rules", async () => {
    findUnique.mockResolvedValue(null as never);
    expect(await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false })).toBe("");
  });

  it("returns '' when draftingRules is empty", async () => {
    findUnique.mockResolvedValue({ draftingRules: {} } as never);
    expect(await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false })).toBe("");
  });

  it("formats global guidance", async () => {
    findUnique.mockResolvedValue({
      draftingRules: { globalGuidance: "Always cite Matter of Dhanasar.", letterSections: {}, petitionSections: {} },
    } as never);
    const out = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false });
    expect(out).toContain("GLOBAL DRAFTING RULES:");
    expect(out).toContain("Always cite Matter of Dhanasar.");
  });

  it("formats letter section rules with tone / mustInclude / avoid", async () => {
    findUnique.mockResolvedValue({
      draftingRules: {
        globalGuidance: "",
        letterSections: {
          opening: {
            instructions: "Open with the recommender's full title.",
            tone: "Formal and authoritative",
            mustInclude: ["institutional affiliation"],
            avoid: ["generic praise"],
          },
        },
        petitionSections: {},
      },
    } as never);
    const out = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false });
    expect(out).toContain("SECTION-SPECIFIC DRAFTING RULES:");
    expect(out).toContain("[opening]: Open with the recommender's full title.");
    expect(out).toContain("Tone: Formal and authoritative");
    expect(out).toContain("Must include: institutional affiliation");
    expect(out).toContain("Avoid: generic praise");
  });

  it("selects petitionSections when isPetition is true", async () => {
    findUnique.mockResolvedValue({
      draftingRules: {
        globalGuidance: "",
        letterSections: { opening: { instructions: "LETTER-ONLY rule" } },
        petitionSections: { prong1_merit: { instructions: "PETITION-ONLY rule" } },
      },
    } as never);
    const petition = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: true });
    expect(petition).toContain("PETITION-ONLY rule");
    expect(petition).not.toContain("LETTER-ONLY rule");

    const letter = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false });
    expect(letter).toContain("LETTER-ONLY rule");
    expect(letter).not.toContain("PETITION-ONLY rule");
  });

  it("skips section rules with blank instructions", async () => {
    findUnique.mockResolvedValue({
      draftingRules: {
        globalGuidance: "",
        letterSections: { opening: { instructions: "   " }, closing: { instructions: "Real rule" } },
        petitionSections: {},
      },
    } as never);
    const out = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false });
    expect(out).toContain("[closing]: Real rule");
    expect(out).not.toContain("[opening]");
  });

  it("returns '' (best-effort) when the DB throws", async () => {
    findUnique.mockRejectedValue(new Error("db down"));
    expect(await loadAttorneyGuidance({ attorneyId: "u1", isPetition: false })).toBe("");
  });
});

describe("briefSectionRuleId — crosswalk (T5)", () => {
  it("maps brief outline IDs to editor petition-section IDs", () => {
    expect(briefSectionRuleId("intro")).toBe("intro");
    expect(briefSectionRuleId("prong1-merit")).toBe("prong1_merit");
    expect(briefSectionRuleId("prong1-importance")).toBe("prong1_importance");
    expect(briefSectionRuleId("prong2")).toBe("prong2");
    expect(briefSectionRuleId("prong3")).toBe("prong3");
  });

  it("strips a leading 'brief-' prefix", () => {
    expect(briefSectionRuleId("brief-prong1-merit")).toBe("prong1_merit");
  });

  it("returns undefined for sections with no dedicated rule", () => {
    expect(briefSectionRuleId("petitioner-qualifications")).toBeUndefined();
    expect(briefSectionRuleId("conclusion")).toBeUndefined();
  });
});

describe("loadAttorneyGuidance — section-precise mode (T5)", () => {
  const rules = {
    draftingRules: {
      globalGuidance: "Firm-wide rule.",
      letterSections: {},
      petitionSections: {
        prong1_merit: { instructions: "MERIT rule" },
        prong2: { instructions: "POSITIONING rule" },
        prong3: { instructions: "WAIVER rule" },
      },
    },
  };

  it("injects only the matching section rule when sectionId is given", async () => {
    findUnique.mockResolvedValue(rules as never);
    const out = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: true, sectionId: "prong1-merit" });
    expect(out).toContain("Firm-wide rule.");
    expect(out).toContain("MERIT rule");
    expect(out).not.toContain("POSITIONING rule");
    expect(out).not.toContain("WAIVER rule");
  });

  it("returns global guidance only for an unmapped section", async () => {
    findUnique.mockResolvedValue(rules as never);
    const out = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: true, sectionId: "conclusion" });
    expect(out).toContain("Firm-wide rule.");
    expect(out).not.toContain("SECTION-SPECIFIC DRAFTING RULES");
  });

  it("injects ALL section rules when no sectionId (one-shot petition-letter)", async () => {
    findUnique.mockResolvedValue(rules as never);
    const out = await loadAttorneyGuidance({ attorneyId: "u1", isPetition: true });
    expect(out).toContain("MERIT rule");
    expect(out).toContain("POSITIONING rule");
    expect(out).toContain("WAIVER rule");
  });
});

describe("loadApplicantGuidance — self-petitioner beta's own rules (User.draftingRules)", () => {
  it("returns '' when the user has no rules", async () => {
    findUserUnique.mockResolvedValue({ draftingRules: null } as never);
    expect(await loadApplicantGuidance({ userId: "u1", isPetition: false })).toBe("");
  });

  it("formats global guidance from the user's own rules, same shape as attorney rules", async () => {
    findUserUnique.mockResolvedValue({
      draftingRules: { globalGuidance: "Keep it terse.", letterSections: {}, petitionSections: {} },
    } as never);
    const out = await loadApplicantGuidance({ userId: "u1", isPetition: false });
    expect(out).toContain("GLOBAL DRAFTING RULES:");
    expect(out).toContain("Keep it terse.");
  });

  it("returns '' (best-effort) when the DB throws", async () => {
    findUserUnique.mockRejectedValue(new Error("db down"));
    expect(await loadApplicantGuidance({ userId: "u1", isPetition: false })).toBe("");
  });
});

describe("resolveDraftingGuidance — routes to the right storage by session role", () => {
  it("loads the applicant's own User.draftingRules for a beta self-drafter", async () => {
    findUserUnique.mockResolvedValue({
      draftingRules: { globalGuidance: "Applicant's own rule.", letterSections: {}, petitionSections: {} },
    } as never);
    const out = await resolveDraftingGuidance(
      { role: "applicant", userId: "applicant-1" },
      { attorneyId: "founder-1" },
      { isPetition: false },
    );
    expect(out).toContain("Applicant's own rule.");
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("loads the assigned attorney's FirmProfile rules for an attorney session", async () => {
    findUnique.mockResolvedValue({
      draftingRules: { globalGuidance: "Firm rule.", letterSections: {}, petitionSections: {} },
    } as never);
    const out = await resolveDraftingGuidance(
      { role: "attorney", userId: "attorney-1" },
      { attorneyId: "attorney-1" },
      { isPetition: false },
    );
    expect(out).toContain("Firm rule.");
    expect(findUserUnique).not.toHaveBeenCalled();
  });
});
