import { describe, it, expect } from "vitest";
import { buildExhibitRows, exhibitRowsToMarkdown } from "../lib/exhibitPlan";

const FORM_DATA = {
  qualifications: {
    field: "AI Safety",
    highestDegree: "phd",
    publications: [
      { title: "Certified Adversarial Robustness", venue: "NeurIPS", year: 2022, citations: 312, role: "first-author" },
    ],
    awards: [{ name: "NSF CAREER Award", issuer: "National Science Foundation", year: 2023 }],
    grants: [{ title: "AI Safety Research", funder: "DARPA", amount: 900000, year: 2022, role: "PI" }],
  },
  nstcCategories: ["AI & Machine Learning"],
  endeavor: { federalPrograms: ["DARPA Assured Autonomy"] },
};

describe("buildExhibitRows", () => {
  it("returns an array", () => {
    const rows = buildExhibitRows(FORM_DATA);
    expect(Array.isArray(rows)).toBe(true);
  });

  it("each row has prong, item, description", () => {
    const rows = buildExhibitRows(FORM_DATA);
    for (const row of rows) {
      expect(row).toHaveProperty("prong");
      expect(row).toHaveProperty("item");
      expect(row).toHaveProperty("description");
    }
  });

  it("always includes the CV/degrees row even for empty formData", () => {
    const rows = buildExhibitRows({});
    expect(rows).toHaveLength(1);
    expect(rows[0].item).toContain("CV");
    expect(rows[0].prong).toBe("Prong 3");
  });
});

describe("exhibitRowsToMarkdown", () => {
  it("produces a markdown table", () => {
    const rows = buildExhibitRows(FORM_DATA);
    if (rows.length === 0) return; // skip if no rows from this data
    const md = exhibitRowsToMarkdown(rows);
    expect(md).toContain("|");
    expect(md).toContain("Prong");
    expect(md).toContain("Item");
  });

  it("handles empty rows", () => {
    const md = exhibitRowsToMarkdown([]);
    expect(typeof md).toBe("string");
  });
});
