import { describe, it, expect } from "vitest";
import { lintDossierProvenance, type LintResult } from "@/lib/dossier/provenanceLinter";

describe("provenanceLinter", () => {
  // ─── Helper ────────────────────────────────────────────────────────

  const verifiedClaims = {
    researcher_profile: {
      status: "verified",
      source: "openalex",
      confidence: 0.92,
      detail: "12 publications, 487 citations",
      sourceUrl: "https://openalex.org/A12345",
    },
    institution: {
      status: "verified",
      source: "ror",
      confidence: 0.95,
      detail: "Stanford University",
      sourceUrl: "https://ror.org/00f54p054",
    },
    nsf_grants: {
      status: "verified",
      source: "nsf",
      confidence: 0.88,
      detail: "NSF Award 2034567",
    },
    awards: {
      status: "self_reported",
      source: "openalex",
      confidence: 0,
      detail: "Best Paper Award",
    },
  };

  // ─── Tests ─────────────────────────────────────────────────────────

  it("passes when all claims are tagged", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "substantialMerit",
          text: 'The Petitioner has authored 12 publications [OpenAlex] with 487 citations [OpenAlex]. The Petitioner received the Best Paper Award [self-reported: Best Paper Award at ICML 2023].',
        },
      ],
      verifiedClaims,
    );

    expect(result.stats.verifiedCited).toBeGreaterThan(0);
    expect(result.stats.selfReportedTagged).toBeGreaterThan(0);
  });

  it("flags untagged numeric claims without verification", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "substantialMerit",
          text: "The Petitioner has authored 50 publications and received 2000 citations. These works span multiple prestigious venues.",
        },
      ],
      verifiedClaims, // verified only shows 12 pubs, 487 citations
    );

    // 50 pubs doesn't match verified 12, and 2000 citations doesn't match 487
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues[0].reason).toContain("lacks source citation");
  });

  it("does not flag numbers that match verified claims within tolerance", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "substantialMerit",
          text: "The Petitioner has authored 12 publications spanning several years of active research in the field.",
        },
      ],
      verifiedClaims, // verified shows 12 publications
    );

    // 12 pubs matches verified exactly — should not flag
    const pubIssues = result.issues.filter((i) =>
      i.reason.includes("publications"),
    );
    expect(pubIssues.length).toBe(0);
  });

  it("passes with all self-reported tags and no verification", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "waiverJustification",
          text: "The Petitioner [self-reported: served as reviewer for 15 journals]. The Petitioner [self-reported: delivered 25 invited talks at major conferences].",
        },
      ],
      null, // no verified claims at all
    );

    expect(result.stats.selfReportedTagged).toBeGreaterThan(0);
  });

  it("flags all numeric claims when no verification exists and no tags", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "substantialMerit",
          text: "The Petitioner has 15 publications and 200 citations. Their work has resulted in 3 patents.",
        },
      ],
      null, // no verified claims
    );

    expect(result.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("handles multiple sections", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "substantialMerit",
          text: "The Petitioner has authored 12 publications [OpenAlex].",
        },
        {
          name: "nationalImportance",
          text: "The 30 grants funded research spanning multiple agencies.",
        },
        {
          name: "waiverJustification",
          text: "With 12 publications [OpenAlex], the Petitioner stands apart.",
        },
      ],
      verifiedClaims,
    );

    // Section 2 mentions "30 grants" without tag — should flag
    const grantIssues = result.issues.filter((i) =>
      i.section === "nationalImportance",
    );
    expect(grantIssues.length).toBeGreaterThan(0);
  });

  it("reports correct stats", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "test",
          text: 'The Petitioner has 12 publications [OpenAlex] and 50 patents. Also [self-reported: received 10 awards for excellence].',
        },
      ],
      verifiedClaims,
    );

    expect(result.stats.verifiedCited).toBe(1); // [OpenAlex]
    expect(result.stats.selfReportedTagged).toBe(1); // [self-reported: ...]
    expect(result.stats.totalClaims).toBeGreaterThanOrEqual(2); // "12 publications" + "50 patents"
  });

  it("non-metric nouns (years, advisors) are not flagged even with small numbers", () => {
    // "years" and "advisors" are not in the METRIC_PATTERN keyword list,
    // so "3 years" and "2 advisors" never match regardless of digit count.
    const result = lintDossierProvenance(
      [
        {
          name: "test",
          text: "The Petitioner completed 3 years of postdoctoral work under 2 advisors.",
        },
      ],
      null,
    );

    expect(result.issues.length).toBe(0);
  });

  it("TRU-5: single-digit metric claims are flagged (5 patents, 1 award)", () => {
    const result = lintDossierProvenance(
      [
        {
          name: "test",
          text: "The Petitioner holds 5 patents and has received 1 award.",
        },
      ],
      null,
    );

    expect(result.issues.length).toBeGreaterThanOrEqual(1);
    const patentIssue = result.issues.find((i) => i.reason.includes("5 patents"));
    expect(patentIssue).toBeDefined();
  });

  it("empty sections produce clean result", () => {
    const result = lintDossierProvenance([], verifiedClaims);

    expect(result.issues.length).toBe(0);
    expect(result.stats.totalClaims).toBe(0);
  });
});
