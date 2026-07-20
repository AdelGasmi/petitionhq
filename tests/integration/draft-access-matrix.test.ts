/**
 * Route-audit matrix — self-petitioner beta Phase 2 (beta_onboarding_plan.md).
 *
 * Walks the drafting auth boundary (lib/auth.ts canDraftCase) as
 * (attorney-on-case, beta-owner applicant, plain applicant, wrong attorney,
 * admin) so a future edit can't silently re-widen or re-narrow the surface.
 *
 * POST /api/cases/[id]/letters needs no LLM/mocking (pure CRUD) so it carries
 * the full success+reject matrix. brief/[narrativeId]/coherence is spot-checked
 * on the reject paths only, to prove the newly-added gate on a route that
 * previously had NO role check at all (canAccessCase let any case owner through).
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

setupAuthMock();

const { POST: createLetterPOST } = await import("@/app/api/cases/[id]/letters/route");
const { POST: coherencePOST } = await import("@/app/api/cases/[id]/brief/[narrativeId]/coherence/route");

function caseParams(id: string) {
  return { params: Promise.resolve({ id }) };
}
function narrativeParams(id: string, narrativeId: string) {
  return { params: Promise.resolve({ id, narrativeId }) };
}

const userIds: string[] = [];
const caseIds: string[] = [];

let attorney: { id: string };
let betaOwner: { id: string };
let plainOwner: { id: string };
let otherAttorney: { id: string };
let admin: { id: string };
let betaCase: { id: string };
let plainCase: { id: string };

beforeAll(async () => {
  attorney = await createTestUser({ role: "attorney", name: "Case Attorney" });
  otherAttorney = await createTestUser({ role: "attorney", name: "Unrelated Attorney" });
  betaOwner = await createTestUser({ role: "applicant", name: "Beta Applicant" });
  plainOwner = await createTestUser({ role: "applicant", name: "Plain Applicant" });
  admin = await createTestUser({ role: "admin", name: "Admin" });
  userIds.push(attorney.id, otherAttorney.id, betaOwner.id, plainOwner.id, admin.id);

  await testPrisma.user.update({ where: { id: betaOwner.id }, data: { selfPetitionerBeta: true } });

  betaCase = await createTestCase(betaOwner.id, { attorneyId: attorney.id });
  plainCase = await createTestCase(plainOwner.id, { attorneyId: attorney.id });
  caseIds.push(betaCase.id, plainCase.id);
});

afterAll(async () => {
  await cleanupTestData({ userIds, caseIds });
  await disconnectTestDb();
});

describe("drafting auth matrix — POST /api/cases/[id]/letters", () => {
  it("attorney-on-case can create a letter", async () => {
    mockSession({ userId: attorney.id, email: "a@test.com", role: "attorney", name: "Attorney" });
    const res = await createLetterPOST(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/letters`, { method: "POST", body: { requirementId: "rec-1", recommender: {} } }),
      caseParams(betaCase.id),
    );
    expect(res.status).toBe(200);
  });

  it("beta-flagged owner can create a letter on their own case", async () => {
    mockSession({ userId: betaOwner.id, email: "beta@test.com", role: "applicant", name: "Beta" });
    const res = await createLetterPOST(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/letters`, { method: "POST", body: { requirementId: "rec-2", recommender: {} } }),
      caseParams(betaCase.id),
    );
    expect(res.status).toBe(200);
  });

  it("a plain (non-beta) applicant owner is forbidden", async () => {
    mockSession({ userId: plainOwner.id, email: "plain@test.com", role: "applicant", name: "Plain" });
    const res = await createLetterPOST(
      buildRequest(`http://localhost:3000/api/cases/${plainCase.id}/letters`, { method: "POST", body: { requirementId: "rec-3", recommender: {} } }),
      caseParams(plainCase.id),
    );
    expect(res.status).toBe(403);
  });

  it("an attorney not assigned to the case gets 404 (BOLA-gated by canAccessCase)", async () => {
    mockSession({ userId: otherAttorney.id, email: "other@test.com", role: "attorney", name: "Other" });
    const res = await createLetterPOST(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/letters`, { method: "POST", body: { requirementId: "rec-4", recommender: {} } }),
      caseParams(betaCase.id),
    );
    expect(res.status).toBe(404);
  });

  it("admin never gets case content, even on a beta case", async () => {
    mockSession({ userId: admin.id, email: "admin@test.com", role: "admin", name: "Admin" });
    const res = await createLetterPOST(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/letters`, { method: "POST", body: { requirementId: "rec-5", recommender: {} } }),
      caseParams(betaCase.id),
    );
    expect(res.status).toBe(404);
  });
});

describe("drafting auth matrix — POST /api/cases/[id]/brief/[narrativeId]/coherence (previously ungated)", () => {
  it("a plain (non-beta) applicant owner is forbidden", async () => {
    mockSession({ userId: plainOwner.id, email: "plain@test.com", role: "applicant", name: "Plain" });
    const res = await coherencePOST(
      buildRequest(`http://localhost:3000/api/cases/${plainCase.id}/brief/i140-niw/coherence`, { method: "POST" }),
      narrativeParams(plainCase.id, "i140-niw"),
    );
    expect(res.status).toBe(403);
  });

  it("admin never gets case content", async () => {
    mockSession({ userId: admin.id, email: "admin@test.com", role: "admin", name: "Admin" });
    const res = await coherencePOST(
      buildRequest(`http://localhost:3000/api/cases/${betaCase.id}/brief/i140-niw/coherence`, { method: "POST" }),
      narrativeParams(betaCase.id, "i140-niw"),
    );
    expect(res.status).toBe(404);
  });
});
