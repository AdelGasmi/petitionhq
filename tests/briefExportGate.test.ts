import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { LintIssue, LintResult } from "@/lib/dossier/provenanceLinter";

/**
 * GAP-4 regression — the brief (.docx) export provenance gate.
 *
 * The brief is the *filing* work product. When the provenance linter flags a
 * numeric claim that lacks a verified-source citation or a [self-reported] tag,
 * the export is HARD-FAILED (422) unless the attorney explicitly overrides with
 * ?ack=1 — and that override is written to the ActivityLog as a
 * malpractice-defense trail. The dossier PDF (a labeled "preliminary
 * assessment") stays non-blocking and is not exercised here.
 *
 * The policy lives in the route, NOT in the linter (which only ever emits
 * "warning" severity). So the gate must trigger on `issues.length > 0`,
 * regardless of severity — that's the contract these tests pin down.
 */

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { lead: { findUnique: vi.fn() } } }));
vi.mock("@/lib/dossierGenerator", () => ({ generateDossier: vi.fn() }));
vi.mock("@/lib/briefDocx", () => ({ generateBriefDocx: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));

import { GET } from "@/app/api/leads/[id]/brief/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateDossier } from "@/lib/dossierGenerator";
import { generateBriefDocx } from "@/lib/briefDocx";
import { logActivity } from "@/lib/activity";

const mockGetSession = vi.mocked(getSession);
const mockFindUnique = vi.mocked(prisma.lead.findUnique);
const mockGenerateDossier = vi.mocked(generateDossier);
const mockGenerateBriefDocx = vi.mocked(generateBriefDocx);
const mockLogActivity = vi.mocked(logActivity);

const ATTORNEY = { userId: "att-1", email: "att@firm.com", role: "attorney", name: "Jane Counsel" };
const ADMIN = { userId: "admin-1", email: "admin@hq.com", role: "admin", name: "HQ Admin" };
const LEAD = {
  id: "lead-1",
  tier: "tier1",
  score: 88,
  caseId: "case-1",
  verifiedClaims: null,
  claimedByUserId: "att-1",
};

function makeParams(id = "lead-1") {
  return { params: Promise.resolve({ id }) };
}

function reqFor(id = "lead-1", query = "") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(`http://localhost:3000/api/leads/${id}/brief${query}`) as any);
}

function lintWith(issues: LintIssue[]): LintResult {
  return {
    issues,
    stats: {
      totalClaims: 12,
      verifiedCited: 5,
      selfReportedTagged: 4,
      untagged: issues.length,
    },
  };
}

/** Minimal DossierData stub — only the fields the route reads off `data`. */
function dossierWith(issues: LintIssue[]) {
  return {
    applicantName: "Dr. Test Applicant",
    provenanceLint: lintWith(issues),
  } as unknown as Awaited<ReturnType<typeof generateDossier>>;
}

const WARN = (section: string, reason: string): LintIssue => ({
  section,
  line: "…the candidate has 199 citations across the body of work…",
  reason,
  severity: "warning",
});

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSession.mockResolvedValue(ATTORNEY as never);
  mockFindUnique.mockResolvedValue(LEAD as never);
  mockGenerateBriefDocx.mockResolvedValue(Buffer.from("PK-fake-docx") as never);
});

describe("GET /api/leads/[id]/brief — GAP-4 provenance export gate", () => {
  it("clean brief (no lint issues) → 200 docx; nothing logged", async () => {
    mockGenerateDossier.mockResolvedValue(dossierWith([]));

    const res = await GET(reqFor(), makeParams());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("wordprocessingml");
    expect(mockGenerateBriefDocx).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("flagged claim + NO ack → 422; docx is NOT built and nothing is logged", async () => {
    const issues = [WARN("substantialMerit", 'Numeric claim "199 citations" lacks source citation')];
    mockGenerateDossier.mockResolvedValue(dossierWith(issues));

    const res = await GET(reqFor(), makeParams());

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("unverified_claims");
    expect(body.issues).toHaveLength(1);
    expect(body.stats.untagged).toBe(1);
    // The whole point: a blocked export must not produce a downloadable file.
    expect(mockGenerateBriefDocx).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("flagged claims + ack=1 → 200 docx AND an override audit record", async () => {
    const issues = [
      WARN("substantialMerit", 'Numeric claim "199 citations" lacks source citation'),
      WARN("nationalImportance", 'Numeric claim "12 publications" lacks source citation'),
    ];
    mockGenerateDossier.mockResolvedValue(dossierWith(issues));

    const res = await GET(reqFor("lead-1", "?ack=1"), makeParams());

    expect(res.status).toBe(200);
    expect(mockGenerateBriefDocx).toHaveBeenCalledTimes(1);
    expect(mockLogActivity).toHaveBeenCalledTimes(1);

    const logged = mockLogActivity.mock.calls[0][0];
    expect(logged.action).toBe("brief.exported_with_unverified_claims");
    expect(logged.caseId).toBe("case-1");
    expect(logged.actor).toMatchObject({ userId: "att-1" });
    // Detail names the affected sections (de-duplicated) for the trail.
    expect(logged.detail).toContain("substantialMerit");
    expect(logged.detail).toContain("nationalImportance");
    expect(logged.detail).toContain("2 untagged");
  });

  it("gate triggers on warning severity (linter never emits errors)", async () => {
    // The route gates on issues.length > 0, not on severity. A warning-only
    // result still produces 422 — the linter only emits warnings, never errors.
    const lint = lintWith([WARN("waiverJustification", "untagged metric")]);
    mockGenerateDossier.mockResolvedValue(dossierWith(lint.issues));

    const res = await GET(reqFor(), makeParams());
    expect(res.status).toBe(422);
  });

  it("BOLA: a non-owning attorney is 403'd before the dossier is ever built", async () => {
    mockFindUnique.mockResolvedValue({ ...LEAD, claimedByUserId: "other-att" } as never);

    const res = await GET(reqFor(), makeParams());

    expect(res.status).toBe(403);
    expect(mockGenerateDossier).not.toHaveBeenCalled();
  });

  it("admin can override too (not BOLA-bound), and it is logged", async () => {
    mockGetSession.mockResolvedValue(ADMIN as never);
    mockFindUnique.mockResolvedValue({ ...LEAD, claimedByUserId: "someone-else" } as never);
    mockGenerateDossier.mockResolvedValue(dossierWith([WARN("substantialMerit", "untagged")]));

    const res = await GET(reqFor("lead-1", "?ack=1"), makeParams());

    expect(res.status).toBe(200);
    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity.mock.calls[0][0].actor).toMatchObject({ userId: "admin-1" });
  });

  it("unauthenticated → 401 (gate never reached)", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(reqFor(), makeParams());
    expect(res.status).toBe(401);
    expect(mockGenerateDossier).not.toHaveBeenCalled();
  });
});
