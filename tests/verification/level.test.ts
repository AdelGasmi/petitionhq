import { describe, it, expect } from "vitest";
import { deriveVerificationLevel } from "@/lib/verification/level";

describe("TRU-1: deriveVerificationLevel", () => {
  it("orcid_oauth → identity_confirmed (OAuth ownership proof)", () => {
    expect(deriveVerificationLevel("high", "orcid_oauth")).toBe("identity_confirmed");
  });

  it("orcid_oauth with any anchor level → identity_confirmed", () => {
    expect(deriveVerificationLevel("medium", "orcid_oauth")).toBe("identity_confirmed");
    expect(deriveVerificationLevel("low", "orcid_oauth")).toBe("identity_confirmed");
    expect(deriveVerificationLevel("none", "orcid_oauth")).toBe("identity_confirmed");
  });

  it("high anchor (openalex_corroborated) without OAuth → publicly_corroborated", () => {
    expect(deriveVerificationLevel("high", "openalex_corroborated")).toBe("publicly_corroborated");
  });

  it("high anchor (orcid_deterministic) without OAuth → publicly_corroborated", () => {
    expect(deriveVerificationLevel("high", "orcid_deterministic")).toBe("publicly_corroborated");
  });

  it("medium anchor → publicly_corroborated", () => {
    expect(deriveVerificationLevel("medium", "openalex_name")).toBe("publicly_corroborated");
    expect(deriveVerificationLevel("medium", "orcid_provided")).toBe("publicly_corroborated");
    expect(deriveVerificationLevel("medium", "sources_only")).toBe("publicly_corroborated");
  });

  it("low anchor → self_reported", () => {
    expect(deriveVerificationLevel("low", "openalex_ambiguous")).toBe("self_reported");
    expect(deriveVerificationLevel("low", "orcid_only")).toBe("self_reported");
  });

  it("none anchor → self_reported", () => {
    expect(deriveVerificationLevel("none", "none")).toBe("self_reported");
  });

  /**
   * TRU-1 acceptance criterion: a lead without OAuth must never render
   * "Identity confirmed" — even with a high anchor, it is only "Publicly
   * corroborated". Only orcid_oauth yields "identity_confirmed".
   */
  it("non-OAuth high anchor must NOT return identity_confirmed", () => {
    const level = deriveVerificationLevel("high", "openalex_corroborated");
    expect(level).not.toBe("identity_confirmed");
    expect(level).toBe("publicly_corroborated");
  });

  it("TRU-4 downgraded (openalex_name, medium) → publicly_corroborated (not self_reported)", () => {
    // TRU-4 downgrades to medium, but the researcher IS publicly corroborated
    // (OA found a matching record); the level correctly reflects that.
    expect(deriveVerificationLevel("medium", "openalex_name")).toBe("publicly_corroborated");
  });
});
