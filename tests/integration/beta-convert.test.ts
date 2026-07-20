/**
 * Integration tests — POST /api/admin/leads/[id]/beta-convert
 *
 * Self-petitioner beta onboarding (petitionhq/beta_onboarding_plan.md Phase 1).
 * Requires local Postgres on port 5433 (Docker dev compose). Email is mocked;
 * no SMTP dependency.
 */
import { randomBytes } from "crypto";
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  testPrisma,
  buildRequest,
  mockSession,
  setupAuthMock,
  createTestUser,
  createTestLead,
  cleanupTestData,
  disconnectTestDb,
} from "./helpers";

setupAuthMock();

// Drift-proof: auto-mock every function export of @/lib/email as a resolved
// no-op, matching tests/integration/attorney-happy-path.test.ts.
vi.mock("@/lib/email", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/email")>();
  const mocked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === "function" ? vi.fn(() => Promise.resolve()) : value;
  }
  return mocked;
});

const { sendBetaInviteEmail, sendIntakeInviteEmail } = await import("@/lib/email");
const { POST } = await import("@/app/api/admin/leads/[id]/beta-convert/route");
const { POST: reversePost } = await import("@/app/api/admin/leads/[id]/beta-reverse/route");

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const userIds: string[] = [];
const caseIds: string[] = [];
const leadIds: string[] = [];

let founderEmail: string;

beforeAll(async () => {
  founderEmail = `founder-${Date.now()}@test.com`;
  const founder = await createTestUser({ email: founderEmail, name: "Founder Attorney", role: "attorney" });
  userIds.push(founder.id);
  process.env.FOUNDER_ATTORNEY_EMAIL = founderEmail;
});

afterAll(async () => {
  await cleanupTestData({ userIds, caseIds, leadIds });
  await disconnectTestDb();
  delete process.env.FOUNDER_ATTORNEY_EMAIL;
});

// Reset mock call counts between tests so per-test email-send assertions are
// independent (vitest config sets no clearMocks). clearAllMocks clears only
// .mock.calls — implementations survive, and the auth mock reads a module-level
// session var, so mockSession() inside each test still takes effect.
beforeEach(() => {
  vi.clearAllMocks();
});

async function approvedLead(overrides: Partial<{ email: string; name: string }> = {}) {
  const lead = await createTestLead({
    email: overrides.email ?? `beta-lead-${randomBytes(4).toString("hex")}@test.com`,
    name: overrides.name ?? "Beta Applicant",
  });
  leadIds.push(lead.id);
  await testPrisma.lead.update({ where: { id: lead.id }, data: { applicantStatus: "approved" } });
  return lead;
}

describe("POST /api/admin/leads/[id]/beta-convert", () => {
  it("returns 403 for a non-admin session", async () => {
    mockSession({ userId: "u1", email: "a@test.com", role: "attorney", name: "A" });
    const lead = await approvedLead();
    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 for a non-existent lead", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const res = await POST(
      buildRequest("http://localhost:3000/api/admin/leads/fake-id/beta-convert", { method: "POST" }),
      makeParams("fake-id"),
    );
    expect(res.status).toBe(404);
  });

  it("invites a NON-consented lead — matching consent is NOT required (2026-07)", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    // No applicantStatus="approved": this lead never asked for attorney matching.
    // The self-petitioner beta is self-serve document software, not matching, so
    // these leads are eligible — this is the whole point of the 2026-07 change.
    const lead = await createTestLead({ email: `unconsented-${randomBytes(4).toString("hex")}@test.com`, name: "Sam Diaz" });
    leadIds.push(lead.id);

    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    userIds.push(data.userId);
    caseIds.push(data.caseId);

    // Exactly one email, and it's the beta invite — never the "[attorney] has
    // started preparing your petition" intake email (which would imply an
    // attorney accepted the case).
    expect(sendBetaInviteEmail).toHaveBeenCalledTimes(1);
    expect(sendIntakeInviteEmail).not.toHaveBeenCalled();

    // The single-send lock is set.
    const updated = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated?.betaInvitedAt).not.toBeNull();
  });

  it("returns 409 when the lead is already claimed or converted", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const lead = await approvedLead();
    await testPrisma.lead.update({
      where: { id: lead.id },
      data: { claimedByUserId: userIds[0], claimedAt: new Date() },
    });

    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(409);
  });

  it("returns 409 when a user already exists with the lead's email", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const existing = await createTestUser({ role: "applicant" });
    userIds.push(existing.id);
    const lead = await approvedLead({ email: existing.email });

    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(409);
  });

  it("returns 500 when no founder attorney account is configured", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const lead = await approvedLead();
    const saved = process.env.FOUNDER_ATTORNEY_EMAIL;
    process.env.FOUNDER_ATTORNEY_EMAIL = "no-such-attorney@test.com";
    try {
      const res = await POST(
        buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
        makeParams(lead.id),
      );
      expect(res.status).toBe(500);
    } finally {
      process.env.FOUNDER_ATTORNEY_EMAIL = saved;
    }
  });

  it("creates a beta applicant, case, and claim on the happy path", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const lead = await approvedLead({ name: "Jordan Rivera" });

    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.userId).toBeTruthy();
    expect(data.caseId).toBeTruthy();
    userIds.push(data.userId);
    caseIds.push(data.caseId);

    const user = await testPrisma.user.findUnique({ where: { id: data.userId } });
    expect(user?.role).toBe("applicant");
    expect(user?.selfPetitionerBeta).toBe(true);
    expect(user?.betaAgreementAcceptedAt).toBeNull();

    const updatedLead = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(updatedLead?.claimedByUserId).toBe(userIds[0]); // the founder attorney
    expect(updatedLead?.caseId).toBe(data.caseId);

    const createdCase = await testPrisma.case.findUnique({ where: { id: data.caseId } });
    expect(createdCase?.ownerId).toBe(data.userId);
    expect(createdCase?.attorneyId).toBe(userIds[0]);

    expect(sendBetaInviteEmail).toHaveBeenCalledTimes(1);
    // autoConvertLead's default intake-invite email ("[attorney] has started
    // preparing your petition...") must NOT fire for beta conversions — it's
    // both redundant (beta users get full logged-in access) and misleading
    // (no real attorney is working the case). The beta invite above is the
    // only email a beta user should receive on conversion.
    expect(sendIntakeInviteEmail).not.toHaveBeenCalled();
  });

  it("sends exactly ONE email — a repeat invite is a 409 no-op (idempotent)", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const lead = await createTestLead({ email: `dup-${randomBytes(4).toString("hex")}@test.com`, name: "Repeat User" });
    leadIds.push(lead.id);

    const first = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(first.status).toBe(201);
    const d1 = await first.json();
    userIds.push(d1.userId);
    caseIds.push(d1.caseId);

    const second = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(second.status).toBe(409);

    // The whole point: two invite attempts, exactly one email ever sent.
    expect(sendBetaInviteEmail).toHaveBeenCalledTimes(1);
  });

  it("is race-proof — two simultaneous invites yield one 201, one 409, one email", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const lead = await createTestLead({ email: `race-${randomBytes(4).toString("hex")}@test.com`, name: "Race User" });
    leadIds.push(lead.id);

    // Fire both handlers concurrently against the same lead. The atomic
    // compare-and-set on betaInvitedAt (updateMany where null) lets exactly one
    // win at the DB row-lock level — the "triple check" backstop.
    const [a, b] = await Promise.all([
      POST(buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }), makeParams(lead.id)),
      POST(buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }), makeParams(lead.id)),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);

    for (const res of [a, b]) {
      if (res.status === 201) {
        const d = await res.json();
        userIds.push(d.userId);
        caseIds.push(d.caseId);
      }
    }

    expect(sendBetaInviteEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps the lock on send failure — never auto-re-invites (at-most-once)", async () => {
    mockSession({ userId: "admin1", email: "admin@test.com", role: "admin", name: "Admin" });
    const lead = await createTestLead({ email: `smtpfail-${randomBytes(4).toString("hex")}@test.com`, name: "Bounce User" });
    leadIds.push(lead.id);

    vi.mocked(sendBetaInviteEmail).mockRejectedValueOnce(new Error("smtp down"));

    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.warning).toContain("failed to send");
    if (data.userId) userIds.push(data.userId);
    if (data.caseId) caseIds.push(data.caseId);

    // Lock held despite the failure — the lead is marked invited so a retry
    // cannot send a second email.
    const updated = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated?.betaInvitedAt).not.toBeNull();

    const retry = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(retry.status).toBe(409);

    // One attempt fired; the retry sent nothing.
    expect(sendBetaInviteEmail).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/admin/leads/[id]/beta-reverse", () => {
  const ADMIN = { userId: "admin1", email: "admin@test.com", role: "admin" as const, name: "Admin" };

  // Invite a fresh non-consented lead through the real convert route so the
  // reverse tests operate on genuine beta state (user + case + lock).
  async function inviteBetaLead() {
    mockSession(ADMIN);
    const lead = await createTestLead({ email: `rev-${randomBytes(4).toString("hex")}@test.com`, name: "Reverse Me" });
    leadIds.push(lead.id);
    const res = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${lead.id}/beta-convert`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    return { leadId: lead.id, userId: data.userId as string, caseId: data.caseId as string };
  }

  function reverse(leadId: string, force?: boolean) {
    return reversePost(
      buildRequest(`http://localhost:3000/api/admin/leads/${leadId}/beta-reverse`, { method: "POST", body: { force: force ?? false } }),
      makeParams(leadId),
    );
  }

  it("returns 403 for a non-admin", async () => {
    mockSession({ userId: "u1", email: "a@test.com", role: "attorney", name: "A" });
    const res = await reverse("whatever");
    expect(res.status).toBe(403);
  });

  it("returns 400 for a lead that was never beta-invited", async () => {
    mockSession(ADMIN);
    const lead = await createTestLead({ email: `noninvited-${randomBytes(4).toString("hex")}@test.com` });
    leadIds.push(lead.id);
    const res = await reverse(lead.id);
    expect(res.status).toBe(400);
  });

  it("clean-reverses an un-activated beta lead back into the pool, and it is re-invitable", async () => {
    const { leadId, userId, caseId } = await inviteBetaLead();
    userIds.push(userId); // defensive: reverse deletes it, but cleanup tolerates missing ids
    caseIds.push(caseId);

    const res = await reverse(leadId);
    expect(res.status).toBe(200);
    expect((await res.json()).tornDown).toBe(true);

    // Lead is back in the pool.
    const lead = await testPrisma.lead.findUnique({ where: { id: leadId } });
    expect(lead?.betaInvitedAt).toBeNull();
    expect(lead?.caseId).toBeNull();
    expect(lead?.claimedByUserId).toBeNull();
    expect(lead?.status).toBe("new");

    // The throwaway account + case are gone.
    expect(await testPrisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await testPrisma.case.findUnique({ where: { id: caseId } })).toBeNull();

    // Re-invitable: a fresh convert on the same lead succeeds (new account+case).
    mockSession(ADMIN);
    const again = await POST(
      buildRequest(`http://localhost:3000/api/admin/leads/${leadId}/beta-convert`, { method: "POST" }),
      makeParams(leadId),
    );
    expect(again.status).toBe(201);
    const d2 = await again.json();
    userIds.push(d2.userId);
    caseIds.push(d2.caseId);
  });

  it("refuses to reverse an ACTIVE beta user without force, then force-wipes", async () => {
    const { leadId, userId, caseId } = await inviteBetaLead();
    userIds.push(userId);
    caseIds.push(caseId);

    // Simulate engagement — they accepted the beta agreement.
    await testPrisma.user.update({ where: { id: userId }, data: { betaAgreementAcceptedAt: new Date() } });

    const blocked = await reverse(leadId, false);
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).needsForce).toBe(true);

    // Nothing was torn down.
    expect((await testPrisma.lead.findUnique({ where: { id: leadId } }))?.caseId).toBe(caseId);
    expect(await testPrisma.user.findUnique({ where: { id: userId } })).not.toBeNull();

    // force wipes everything and returns the lead to the pool.
    const forced = await reverse(leadId, true);
    expect(forced.status).toBe(200);
    expect((await forced.json()).tornDown).toBe(true);
    expect(await testPrisma.user.findUnique({ where: { id: userId } })).toBeNull();
    expect(await testPrisma.case.findUnique({ where: { id: caseId } })).toBeNull();
    const finalLead = await testPrisma.lead.findUnique({ where: { id: leadId } });
    expect(finalLead?.betaInvitedAt).toBeNull();
    expect(finalLead?.caseId).toBeNull();
  });
});
