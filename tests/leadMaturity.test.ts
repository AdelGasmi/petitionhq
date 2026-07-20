import { describe, it, expect } from "vitest";
import { canTransition, nextMaturity, hasCompletedDeepIntake, type LeadMaturity } from "../lib/leadMaturity";

describe("canTransition", () => {
  const ALL: LeadMaturity[] = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7"];

  it("allows M0 → M1 only", () => {
    expect(canTransition("M0", "M1")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M1")) {
      expect(canTransition("M0", to)).toBe(false);
    }
  });

  it("allows M1 → M2 only", () => {
    expect(canTransition("M1", "M2")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M2")) {
      expect(canTransition("M1", to)).toBe(false);
    }
  });

  it("allows M2 → M3 only", () => {
    expect(canTransition("M2", "M3")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M3")) {
      expect(canTransition("M2", to)).toBe(false);
    }
  });

  it("allows M3 → M4 or M7 (direct verification path)", () => {
    expect(canTransition("M3", "M4")).toBe(true);
    expect(canTransition("M3", "M7")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M4" && s !== "M7")) {
      expect(canTransition("M3", to)).toBe(false);
    }
  });

  it("allows M4 → M5 or M7 (skip path)", () => {
    expect(canTransition("M4", "M5")).toBe(true);
    expect(canTransition("M4", "M7")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M5" && s !== "M7")) {
      expect(canTransition("M4", to)).toBe(false);
    }
  });

  it("allows M5 → M6 or M7 (skip path)", () => {
    expect(canTransition("M5", "M6")).toBe(true);
    expect(canTransition("M5", "M7")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M6" && s !== "M7")) {
      expect(canTransition("M5", to)).toBe(false);
    }
  });

  it("allows M6 → M7 only", () => {
    expect(canTransition("M6", "M7")).toBe(true);
    for (const to of ALL.filter((s) => s !== "M7")) {
      expect(canTransition("M6", to)).toBe(false);
    }
  });

  it("M7 is terminal — no transitions", () => {
    for (const to of ALL) {
      expect(canTransition("M7", to)).toBe(false);
    }
  });

  it("rejects backward transitions", () => {
    expect(canTransition("M3", "M1")).toBe(false);
    expect(canTransition("M7", "M0")).toBe(false);
    expect(canTransition("M5", "M4")).toBe(false);
  });

  it("rejects self-transitions", () => {
    for (const state of ALL) {
      expect(canTransition(state, state)).toBe(false);
    }
  });
});

describe("nextMaturity", () => {
  it("advances on valid trigger", () => {
    expect(nextMaturity("M0", "light_wizard_complete")).toBe("M1");
    expect(nextMaturity("M1", "deep_wizard_complete")).toBe("M2");
    expect(nextMaturity("M2", "consent_given")).toBe("M3");
    expect(nextMaturity("M3", "dossier_complete")).toBe("M4");
    expect(nextMaturity("M3", "verification_complete")).toBe("M7");
    expect(nextMaturity("M4", "verification_complete")).toBe("M7");
  });

  it("returns null for unknown trigger", () => {
    expect(nextMaturity("M0", "bogus_trigger")).toBeNull();
  });

  it("returns null when trigger target is not a legal transition", () => {
    expect(nextMaturity("M0", "consent_given")).toBeNull(); // M0 can't jump to M3
    expect(nextMaturity("M2", "dossier_complete")).toBeNull(); // M2 can't jump to M4
  });

  it("supports skip paths via M4 → M7", () => {
    expect(nextMaturity("M4", "verification_complete")).toBe("M7");
    expect(nextMaturity("M4", "layer2_complete")).toBe("M5");
  });

  it("supports M5 → M6 and M5 → M7", () => {
    expect(nextMaturity("M5", "layer3_complete")).toBe("M6");
    expect(nextMaturity("M5", "verification_complete")).toBe("M7");
  });
});

describe("hasCompletedDeepIntake (M7 completeness gate)", () => {
  it("is false for a light-only lead (the half-baked marketplace lead)", () => {
    // Exactly what POST /api/leads saves from the 5-question light wizard.
    const light = { field: "Statistics", degree: "Master's", yearsExperience: "2-5", publications: "1-3", citations: "1-50" };
    expect(hasCompletedDeepIntake(light)).toBe(false);
  });

  it("is true once any deep-evidence field is answered — including a deliberate 'None'", () => {
    expect(hasCompletedDeepIntake({ field: "CS", patents: "None", awards: "None", grants: "None" })).toBe(true);
    expect(hasCompletedDeepIntake({ usPlan: "Funded position, signed agreement" })).toBe(true);
    expect(hasCompletedDeepIntake({ employerSituation: "I have an employer who could sponsor me" })).toBe(true);
  });

  it("ignores blank/whitespace deep fields (a deep wizard left entirely empty is not 'complete')", () => {
    expect(hasCompletedDeepIntake({ patents: "", awards: "   ", grants: "" })).toBe(false);
  });

  it("is false for null/undefined formData", () => {
    expect(hasCompletedDeepIntake(null)).toBe(false);
    expect(hasCompletedDeepIntake(undefined)).toBe(false);
  });
});
