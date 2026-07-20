/**
 * Attorney platform-terms gate + official-form PDF UPL guard (2026-07-05).
 *
 * 1. GET /api/cases/[id]/pdf — official-USCIS-form auto-fill is attorney-only.
 *    Applicants (incl. beta self-petitioners, who CAN draft letters/brief)
 *    must get 403: filled government forms are the UPL line
 *    (self_petitioner_beta.md §4.4).
 *
 * 2. POST /api/profile/attorney-terms — acceptance stamping (attorney-only).
 *
 * 3. POST /api/leads/[id]/claim — attorneys without current terms get
 *    403 { code: "attorney_terms_required" }; with terms, the gate no longer
 *    fires (whatever else the route returns).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  buildRequest,
  mockSession,
  setupAuthMock,
  createTestUser,
  createTestCase,
  cleanupTestData,
  disconnectTestDb,
  testPrisma,
} from "./helpers";
import { ATTORNEY_TERMS_VERSION } from "@/lib/attorneyTerms";

setupAuthMock();

const { GET: pdfGET } = await import("@/app/api/cases/[id]/pdf/route");
const { POST: termsPOST } = await import("@/app/api/profile/attorney-terms/route");
const { POST: claimPOST } = await import("@/app/api/leads/[id]/claim/route");

function caseParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const userIds: string[] = [];
const caseIds: string[] = [];

let attorney: { id: string };
let betaOwner: { id: string };
let betaCase: { id: string };

beforeAll(async () => {
  attorney = await createTestUser({ role: "attorney", name: "Terms Attorney" });
  betaOwner = await createTestUser({ role: "applicant", name: "Beta Owner" });
  userIds.push(attorney.id, betaOwner.id);

  await testPrisma.user.update({
    where: { id: betaOwner.id },
    data: { selfPetitionerBeta: true, betaAgreementAcceptedAt: new Date() },
  });

  betaCase = await createTestCase(betaOwner.id, { attorneyId: attorney.id });
  caseIds.push(betaCase.id);
});

afterAll(async () => {
  await cleanupTestData({ userIds, caseIds });
  await disconnectTestDb();
});

describe("UPL guard — GET /api/cases/[id]/pdf", () => {
  it("beta self-petitioner owner is refused the filled government form", async () => {
    mockSession({ userId: betaOwner.id, email: "b@test.com", role: "applicant", name: "Beta" });
    const res = await pdfGET(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/pdf`),
      caseParams(betaCase.id),
    );
    expect(res.status).toBe(403);
  });

  it("attorney-on-case still gets the auto-fill (not blocked by the guard)", async () => {
    mockSession({ userId: attorney.id, email: "a@test.com", role: "attorney", name: "Att" });
    const res = await pdfGET(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/pdf`),
      caseParams(betaCase.id),
    );
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});

describe("attorney platform terms", () => {
  it("applicant cannot accept attorney terms", async () => {
    mockSession({ userId: betaOwner.id, email: "b@test.com", role: "applicant", name: "Beta" });
    const res = await termsPOST(
      buildRequest(`http://localhost:3000/api/profile/attorney-terms`, { method: "POST" }),
    );
    expect(res.status).toBe(403);
  });

  it("claim is blocked for an attorney without current terms", async () => {
    mockSession({ userId: attorney.id, email: "a@test.com", role: "attorney", name: "Att" });
    const res = await claimPOST(
      buildRequest(`http://localhost:3000/api/leads/nonexistent/claim`, { method: "POST" }),
      caseParams("nonexistent"),
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("attorney_terms_required");
  });

  it("accepting stamps timestamp + version, and unblocks the claim gate", async () => {
    mockSession({ userId: attorney.id, email: "a@test.com", role: "attorney", name: "Att" });
    const accept = await termsPOST(
      buildRequest(`http://localhost:3000/api/profile/attorney-terms`, { method: "POST" }),
    );
    expect(accept.status).toBe(200);

    const row = await testPrisma.user.findUnique({
      where: { id: attorney.id },
      select: { attorneyTermsAcceptedAt: true, attorneyTermsVersion: true },
    });
    expect(row?.attorneyTermsAcceptedAt).toBeTruthy();
    expect(row?.attorneyTermsVersion).toBe(ATTORNEY_TERMS_VERSION);

    // Gate no longer fires — the route proceeds to its normal logic
    // (nonexistent lead → whatever non-terms failure, never the terms 403).
    const res = await claimPOST(
      buildRequest(`http://localhost:3000/api/leads/nonexistent/claim`, { method: "POST" }),
      caseParams("nonexistent"),
    );
    if (res.status === 403) {
      const body = (await res.json()) as { code?: string };
      expect(body.code).not.toBe("attorney_terms_required");
    }
  });
});
