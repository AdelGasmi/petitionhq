import { describe, it, expect } from "vitest";
import {
  ddmmyy,
  nameSlug,
  tierLabel,
  petitionerSlug,
  dossierStorageKey,
  dossierFilename,
  formPdfFilename,
  petitionLetterFilename,
  recLetterFilename,
  leadsCsvFilename,
} from "@/lib/fileNames";

// Fixed date for deterministic tests
const DATE = new Date("2026-05-17T12:00:00Z");

describe("ddmmyy", () => {
  it("formats date as DDMMYY", () => {
    expect(ddmmyy(DATE)).toBe("170526");
  });

  it("zero-pads single-digit day and month", () => {
    const jan = new Date("2026-01-05T12:00:00Z");
    expect(ddmmyy(jan)).toBe("050126");
  });

  it("uses current date when no argument", () => {
    const result = ddmmyy();
    expect(result).toMatch(/^\d{6}$/);
  });
});

describe("nameSlug", () => {
  it("converts a simple name to Title-Case hyphenated", () => {
    expect(nameSlug("jane doe")).toBe("Jane-Doe");
  });

  it("strips single initials like 'M.'", () => {
    expect(nameSlug("Jane M. Doe")).toBe("Jane-Doe");
  });

  it("strips non-alpha characters but keeps multi-char words", () => {
    // "Dr." has 2+ chars so it survives the initial filter; apostrophes/hyphens stripped
    expect(nameSlug("Dr. O'Brien-Smith")).toBe("Dr-OBrienSmith");
  });

  it("returns fallback for null/undefined/empty", () => {
    expect(nameSlug(null)).toBe("Unknown");
    expect(nameSlug(undefined)).toBe("Unknown");
    expect(nameSlug("")).toBe("Unknown");
    expect(nameSlug("  ")).toBe("Unknown");
  });

  it("accepts custom fallback", () => {
    expect(nameSlug(null, "Anon")).toBe("Anon");
  });

  it("title-cases each word", () => {
    expect(nameSlug("yuki tanaka")).toBe("Yuki-Tanaka");
  });
});

describe("tierLabel", () => {
  it("extracts tier number", () => {
    expect(tierLabel("tier1")).toBe("T1");
    expect(tierLabel("tier2")).toBe("T2");
    expect(tierLabel("tier3")).toBe("T3");
  });

  it("returns T3 for null/undefined", () => {
    expect(tierLabel(null)).toBe("T3");
    expect(tierLabel(undefined)).toBe("T3");
  });

  it("handles non-standard strings", () => {
    // No trailing digit — falls back to uppercase slice
    expect(tierLabel("strong")).toBe("ST");
  });
});

describe("petitionerSlug", () => {
  it("combines given + family name", () => {
    expect(petitionerSlug({ givenName: "Yuki", familyName: "Tanaka" })).toBe("Yuki-Tanaka");
  });

  it("handles missing givenName", () => {
    expect(petitionerSlug({ familyName: "Tanaka" })).toBe("Tanaka");
  });

  it("returns fallback for null", () => {
    expect(petitionerSlug(null)).toBe("Applicant");
  });

  it("returns fallback for empty object", () => {
    expect(petitionerSlug({})).toBe("Applicant");
  });

  it("accepts custom fallback", () => {
    expect(petitionerSlug(null, "Client")).toBe("Client");
  });
});

describe("dossierStorageKey", () => {
  it("builds R2 key with date, name, tier, and leadId", () => {
    const key = dossierStorageKey("lead-abc", "Yuki Tanaka", "tier1", DATE);
    expect(key).toBe("dossiers/170526_Yuki-Tanaka_T1/lead-abc.pdf");
  });

  it("uses fallback name when null", () => {
    const key = dossierStorageKey("lead-abc", null, "tier2", DATE);
    expect(key).toContain("Unknown");
  });
});

describe("dossierFilename", () => {
  it("builds download filename", () => {
    const name = dossierFilename("Yuki Tanaka", "tier1", DATE);
    expect(name).toBe("Dossier_Yuki-Tanaka_T1_170526.pdf");
  });

  it("handles null name and tier", () => {
    const name = dossierFilename(null, null, DATE);
    expect(name).toBe("Dossier_Unknown_T3_170526.pdf");
  });
});

describe("formPdfFilename", () => {
  it("builds form PDF filename", () => {
    const name = formPdfFilename("I-140", { givenName: "Yuki", familyName: "Tanaka" }, DATE);
    expect(name).toBe("I-140_Yuki-Tanaka_170526.pdf");
  });

  it("uppercases and sanitizes form number", () => {
    const name = formPdfFilename("i-485 (adj)", { givenName: "Test" }, DATE);
    expect(name).toMatch(/^I-485--ADJ-_/);
  });
});

describe("petitionLetterFilename", () => {
  it("builds PDF filename", () => {
    const name = petitionLetterFilename({ givenName: "Yuki", familyName: "Tanaka" }, "pdf", DATE);
    expect(name).toBe("PetitionLetter_Yuki-Tanaka_170526.pdf");
  });

  it("builds DOCX filename", () => {
    const name = petitionLetterFilename({ givenName: "Yuki", familyName: "Tanaka" }, "docx", DATE);
    expect(name).toBe("PetitionLetter_Yuki-Tanaka_170526.docx");
  });
});

describe("recLetterFilename", () => {
  it("builds rec letter filename with both names", () => {
    const name = recLetterFilename("Dr. Smith", { givenName: "Yuki", familyName: "Tanaka" }, "pdf", DATE);
    expect(name).toBe("RecLetter_Dr-Smith_Yuki-Tanaka_170526.pdf");
  });

  it("uses Recommender fallback for null recommender", () => {
    const name = recLetterFilename(null, { givenName: "Yuki" }, "docx", DATE);
    expect(name).toContain("Recommender");
  });
});

describe("leadsCsvFilename", () => {
  it("builds CSV filename with date", () => {
    expect(leadsCsvFilename(DATE)).toBe("Leads_170526.csv");
  });
});
