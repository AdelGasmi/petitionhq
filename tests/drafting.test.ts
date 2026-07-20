import { describe, it, expect } from "vitest";
import { extractEvidence, buildDraftMessages, type DraftRequest } from "../lib/drafting";
import type { LetterRequirement } from "@/forms/types";

const BASE_QUALS = {
  publications: [
    { title: "Certified Adversarial Robustness via Randomized Smoothing", venue: "NeurIPS", year: 2022, citations: 312, impactFactor: 18.4, citationPercentile: "top 2%", role: "first-author" },
    { title: "Formal Verification for Safety-Critical AI", venue: "IEEE S&P", year: 2023, citations: 187 },
  ],
  awards: [
    { name: "NSF CAREER Award", issuer: "NSF", year: 2023, significance: "Fewer than 20% accepted." },
    { name: "MIT TR35", year: 2023 },
  ],
  grants: [
    { title: "Certified AI Safety for National Infrastructure", funder: "NSF", amount: 1200000, year: 2023, role: "PI" },
  ],
  patents: [
    { title: "Randomized Smoothing Certification Method", number: "US11234567", year: 2023, status: "granted" },
  ],
  editorialRoles: [
    { journal: "NeurIPS", role: "Area Chair", year: 2024 },
  ],
  mediaCoverage: [
    { outlet: "MIT Technology Review", title: "AI Safety's New Benchmark", year: 2023, reach: "3M monthly readers" },
  ],
  invitedTalks: [
    { title: "Certified Robustness at Scale", venue: "ICLR 2024", year: 2024, kind: "keynote" },
  ],
};

describe("extractEvidence", () => {
  it("extracts publications with enrichment atoms", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const pubs = atoms.filter((a) => a.kind === "publication");
    expect(pubs).toHaveLength(2);
    expect(pubs[0].summary).toBe("Certified Adversarial Robustness via Randomized Smoothing");
    expect(pubs[0].detail).toContain("NeurIPS");
    expect(pubs[0].detail).toContain("IF=18.4");
    expect(pubs[0].detail).toContain("ESI: top 2%");
    expect(pubs[0].metric).toBe("312 citations");
  });

  it("extracts awards", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const awards = atoms.filter((a) => a.kind === "award");
    expect(awards).toHaveLength(2);
    expect(awards[0].summary).toBe("NSF CAREER Award");
    expect(awards[0].detail).toContain("20%");
    expect(awards[0].year).toBe(2023);
  });

  it("extracts grants with funder and role", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const grants = atoms.filter((a) => a.kind === "grant");
    expect(grants).toHaveLength(1);
    expect(grants[0].summary).toContain("Certified AI Safety");
    expect(grants[0].metric).toBe("PI");
  });

  it("extracts patents", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const patents = atoms.filter((a) => a.kind === "patent");
    expect(patents).toHaveLength(1);
    expect(patents[0].detail).toContain("US11234567");
    expect(patents[0].metric).toBe("granted");
  });

  it("extracts editorial roles", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const roles = atoms.filter((a) => a.kind === "role");
    expect(roles).toHaveLength(1);
    expect(roles[0].summary).toBe("NeurIPS");
    expect(roles[0].detail).toBe("Area Chair");
  });

  it("extracts media coverage", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const media = atoms.filter((a) => a.kind === "media");
    expect(media).toHaveLength(1);
    expect(media[0].summary).toContain("MIT Technology Review");
    expect(media[0].detail).toContain("3M");
  });

  it("extracts invited talks", () => {
    const atoms = extractEvidence({ qualifications: BASE_QUALS });
    const talks = atoms.filter((a) => a.kind === "talk");
    expect(talks).toHaveLength(1);
    expect(talks[0].metric).toBe("keynote");
  });

  it("skips entries with missing required fields", () => {
    const atoms = extractEvidence({
      qualifications: {
        publications: [{ year: 2023, citations: 50 }], // no title
        awards: [{ issuer: "NSF" }], // no name
        grants: [{ funder: "NSF" }], // no title
      },
    });
    expect(atoms).toHaveLength(0);
  });

  it("returns empty array for empty formData", () => {
    expect(extractEvidence({})).toHaveLength(0);
    expect(extractEvidence({ qualifications: {} })).toHaveLength(0);
  });
});

describe("buildDraftMessages — attorney rules reach the prompt (streaming path)", () => {
  const baseReq = (additionalGuidance?: string): DraftRequest => ({
    letter: { id: "rec-1", kind: "recommendation-dependent" } as LetterRequirement,
    applicant: { name: "Dr. Chen", field: "AI Safety", endeavor: "advance certified robustness", highlightedEvidence: [] },
    recommender: { name: "Prof. Lee", title: "Professor", institution: "MIT", kind: "dependent" },
    additionalGuidance,
  });

  it("injects attorney guidance into the SYSTEM message when present (T4)", () => {
    const guidance = "ATTORNEY GLOBAL RULES:\nOpen with the recommender's full institutional title.";
    const [system, user] = buildDraftMessages(baseReq(guidance));
    // Firm rules are durable instructions → system prompt, not the user turn.
    expect(system.content).toContain("ATTORNEY FIRM RULES (apply throughout):");
    expect(system.content).toContain("ATTORNEY GLOBAL RULES:");
    expect(system.content).toContain("Open with the recommender's full institutional title.");
    expect(user.content).not.toContain("ATTORNEY GLOBAL RULES:");
    expect(user.content).not.toContain("Additional guidance:");
  });

  it("omits the guidance block when no rules are configured", () => {
    const [system] = buildDraftMessages(baseReq(undefined));
    expect(system.content).not.toContain("ATTORNEY FIRM RULES");
  });
});
