import { describe, it, expect } from "vitest";
import { generatePetitionBriefDocx } from "@/lib/petitionBriefDocx";

/**
 * Case-workspace petition-brief export renderer produces a real, white-label
 * document. The brief is the attorney's filed work product, so the output must
 * carry NO PetitionHQ branding (we do not stamp our mark on their legal work).
 *
 * NOTE: the PDF renderer (`petitionBriefPdf.tsx`) is JSX and is verified via a
 * standalone tsx smoke run (see pre_launch_readiness.md), not here — vitest's
 * import-analysis can't transform the @react-pdf .tsx under the Next jsx config.
 */
const sections = [
  { heading: "Introduction & Summary of Argument", body: "First paragraph.\n\nSecond paragraph with a\nsoft break." },
  { heading: "Prong 1 — Substantial Merit", body: "" }, // un-drafted → placeholder
];
const opts = { title: "EB-2 NIW Petition Brief", petitionerName: "Dr. Rao" };

describe("petition brief export renderers", () => {
  it("renders a non-empty .docx (ZIP container) with no PetitionHQ branding", async () => {
    const buf = await generatePetitionBriefDocx(sections, opts);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK"); // .docx is a zip
    // White-label: the brand string must not appear in the document XML.
    expect(buf.toString("latin1").toLowerCase()).not.toContain("petitionhq");
  });

});
