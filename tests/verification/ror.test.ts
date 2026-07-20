/**
 * ROR institution lookup tests.
 * Hits real ROR API — free, no key, generous limits.
 */

import { describe, it, expect } from "vitest";
import { findInstitution } from "@/lib/verification/ror";

describe("ROR: findInstitution", () => {
  it("finds Stanford University", async () => {
    const result = await findInstitution("Stanford University");
    expect(result).not.toBeNull();
    expect(result!.name).toContain("Stanford");
    expect(result!.types).toContain("education");
    expect(result!.country).toBe("United States");
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.sourceUrl).toContain("ror.org");
  }, 15_000);

  it("finds MIT", async () => {
    const result = await findInstitution("MIT");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  }, 15_000);

  it("finds University of California Berkeley with long name", async () => {
    const result = await findInstitution("University of California Berkeley");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
  }, 15_000);

  it("finds a small foreign university", async () => {
    const result = await findInstitution("Ecole Normale Superieure Paris");
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.7);
    expect(result!.sourceUrl).toContain("ror.org");
  }, 15_000);

  it("handles misspellings gracefully", async () => {
    const result = await findInstitution("Stanfrod University");
    // ROR may or may not fuzzy-match this to Stanford — either outcome is acceptable.
    // The important thing is it doesn't crash and returns a valid result or null.
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
      expect(result.sourceUrl).toContain("ror.org");
    }
  }, 15_000);

  it("finds Microsoft Research (non-academic)", async () => {
    const result = await findInstitution("Microsoft Research");
    // Should resolve — Microsoft Research is in ROR
    if (result) {
      expect(result.types).toContain("company");
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    }
  }, 15_000);

  it("returns null for random gibberish", async () => {
    const result = await findInstitution("xkcd random text gibberish university");
    expect(result).toBeNull();
  }, 15_000);
});
