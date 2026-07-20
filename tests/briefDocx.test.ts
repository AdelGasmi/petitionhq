import { describe, it, expect } from "vitest";
import { generateBriefDocx } from "../lib/briefDocx";
import type { DossierData } from "../lib/dossierGenerator";

function makeData(overrides: Partial<DossierData> = {}): DossierData {
  const base = {
    caseId: "case_test",
    field: "AI Safety",
    tier: "tier3",
    score: 82,
    exhibitRows: [
      { prong: "Prong 1", item: "Funding evidence", description: "DARPA — $900,000" },
      { prong: "Prong 2", item: "Publications (3)", description: "3 peer-reviewed papers" },
    ],
    exhibitMarkdown: "",
    skeleton: { substantialMerit: [], nationalImportance: [], waiverJustification: [] },
    brief: {
      substantialMerit:
        "The applicant's work on certified robustness [OpenAlex] has substantial merit.\n\nA second paragraph elaborates the contribution.",
      nationalImportance: "This endeavor aligns with the NSTC critical-technology list.",
      waiverJustification:
        "Independent recognition via 312 citations [self-reported: citation count] supports a waiver.",
    },
    prong1Draft: "",
    applicantName: "Dr. Test Researcher",
    formData: {},
  } as unknown as DossierData;
  return { ...base, ...overrides };
}

describe("generateBriefDocx", () => {
  it("produces a non-empty .docx (ZIP) buffer", async () => {
    const buf = await generateBriefDocx(makeData());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    // .docx files are ZIP archives — magic bytes are "PK".
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("handles empty brief sections and no exhibit rows without throwing", async () => {
    const buf = await generateBriefDocx(
      makeData({
        exhibitRows: [],
        brief: { substantialMerit: "", nationalImportance: "", waiverJustification: "" },
      })
    );
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("does not throw when applicantName is blank (anonymity-safe fallback)", async () => {
    const buf = await generateBriefDocx(makeData({ applicantName: "" }));
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
