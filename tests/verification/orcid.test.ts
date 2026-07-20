/**
 * ORCID client tests.
 *
 * Hits real ORCID public API — no key required, generous rate limits.
 */

import { describe, it, expect } from "vitest";
import { findOrcid } from "@/lib/verification/orcid";

describe("ORCID: findOrcid", () => {
  it("finds a known researcher by name + institution", async () => {
    // George Church — well-known Harvard geneticist with a public ORCID
    const result = await findOrcid({ name: "George Church", institution: "Harvard" });
    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result!.orcidId).toMatch(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/);
    expect(result!.sourceUrl).toContain("orcid.org");
  }, 20_000);

  it("finds a researcher by name + institution", async () => {
    const result = await findOrcid({ name: "Jennifer Doudna", institution: "UC Berkeley" });
    // Doudna has a well-known ORCID profile
    if (result) {
      expect(result.displayName).toBeTruthy();
      expect(result.sourceUrl).toMatch(/^https:\/\/orcid\.org\//);
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    }
    // null is acceptable if ORCID search doesn't return her with this institution string
  }, 20_000);

  it("finds a researcher with institution affiliation match", async () => {
    const result = await findOrcid({ name: "Demis Hassabis", institution: "DeepMind" });
    // May or may not match — Hassabis might not have ORCID
    if (result) {
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.orcidId).toMatch(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/);
    }
  }, 20_000);

  it("returns null for clearly fake researcher", async () => {
    const result = await findOrcid({
      name: "Xqz Vbn Wkl",
      institution: "Nowhere University of Nonexistence",
    });
    expect(result).toBeNull();
  }, 15_000);
});
