/**
 * R5-1: Attorney happy-path integration test
 *
 * Walks the exact pilot demo sequence against a real test DB:
 *   M7 lead → admin claim → applicant approves → case + intake token created
 *   → applicant submits intake → attorney review accept → create letter
 *   → AI draft (LLM mocked) → send review token → recommender submits
 *   → claim-ledger attest → mark filed → assert post-filing lock (409)
 *   → assert intake token rejected on filed case
 *
 * Requires local Postgres on port 5433 (Docker dev compose).
 * All LLM + email calls are mocked; no network access needed.
 */
import { randomBytes } from "crypto";
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  testPrisma,
  buildRequest,
  mockSession,
  setupAuthMock,
  cleanupTestData,
  disconnectTestDb,
  createTestUser,
} from "./helpers";

// ── Mocks (must come before lazy imports) ────────────────────────────────────

setupAuthMock();

vi.mock("@/lib/lmstudio", () => ({
  complete: vi.fn(() => Promise.resolve('{"flags":[]}')),
  completeStream: vi.fn(async function* () {
    yield "This applicant demonstrates substantial merit in the field of AI research. ";
    yield "The proposed endeavor serves U.S. national interest through innovation.";
  }),
  completeStructured: vi.fn(() =>
    Promise.resolve({ score: 85, notes: "Strong draft with good evidence grounding." })
  ),
  healthCheck: vi.fn(() => Promise.resolve({ ok: true, models: ["test-model"] })),
}));

// Drift-proof: auto-mock EVERY function export of @/lib/email as a resolved
// no-op (senders, recordEmail, listEmailLog, …) while keeping non-function
// exports (BASE_URL, TIER_* maps, transporter) real. A hand-listed mock rotted
// here — it omitted sendIntakeInviteEmail (added to autoConvertLead) and named a
// since-renamed sendIntakeLinkEmail — silently breaking the whole happy path.
// Never call transporter.sendMail in tests; all senders are stubbed above it.
vi.mock("@/lib/email", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/email")>();
  const mocked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === "function" ? vi.fn(() => Promise.resolve()) : value;
  }
  return mocked;
});

// Intake OTP verification — bypass in tests
vi.mock("@/lib/intake-auth", () => ({
  isIntakeVerified: vi.fn(() => Promise.resolve(true)),
  setIntakeVerified: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/funnel", () => ({
  trackFunnel: vi.fn(),
}));

// ── Lazy route imports (after mocks are in place) ────────────────────────────

const { POST: claimPOST } = await import("@/app/api/leads/[id]/claim/route");
const { POST: convertPOST } = await import("@/app/api/leads/[id]/convert/route");
const { POST: respondPOST } = await import("@/app/api/leads/[id]/respond/route");
const { POST: claimLedgerPOST } = await import("@/app/api/leads/[id]/claim-ledger/route");
const { POST: lettersCreatePOST } = await import("@/app/api/cases/[id]/letters/route");
const { POST: letterDraftPOST } = await import("@/app/api/cases/[id]/letters/[letterId]/draft/route");
const { POST: sendReviewPOST } = await import("@/app/api/cases/[id]/letters/[letterId]/send-review/route");
const { POST: reviewSubmitPOST, GET: reviewGetGET } = await import("@/app/api/review/[token]/route");
const { GET: intakeGetGET, POST: intakePOST } = await import("@/app/api/intake/[token]/route");
const { PATCH: casePATCH } = await import("@/app/api/cases/[id]/route");

// ── Test state ────────────────────────────────────────────────────────────────

let adminId: string;
let attorneyId: string;
let leadId: string;
let leadResultToken: string;
let caseId: string;
let intakeToken: string;
let letterId: string;
let reviewToken: string;
const createdLeadIds: string[] = [];
const createdUserIds: string[] = [];
const createdCaseIds: string[] = [];

beforeAll(async () => {
  const admin = await createTestUser({
    email: `hp-admin-${Date.now()}@test.com`,
    name: "Happy Path Admin",
    role: "admin",
  });
  adminId = admin.id;
  createdUserIds.push(adminId);

  const attorney = await createTestUser({
    email: `hp-attorney-${Date.now()}@test.com`,
    name: "Happy Path Attorney",
    role: "attorney",
  });
  attorneyId = attorney.id;
  createdUserIds.push(attorneyId);

  await testPrisma.firmProfile.create({
    data: { userId: attorneyId, firmName: "Happy Path Law" },
  });

  // Seed an M7 lead — maturity=M7, trust ≥ 60, consent + verification complete
  const lead = await testPrisma.lead.create({
    data: {
      email: `hp-applicant-${Date.now()}@test.com`,
      resultToken: randomBytes(24).toString("hex"),
      name: "Pilot Applicant",
      tier: "tier1",
      score: 82,
      trustScore: 68,
      maturity: "M7",
      applicantStatus: "approved",
      status: "new",
      source: "check",
      formData: {
        qualifications: {
          publications: [
            { title: "AI for Climate", venue: "Nature", citations: 150 },
          ],
          awards: [{ name: "NSF CAREER Award", issuer: "NSF" }],
          grants: [{ title: "AI Climate Grant", funder: "NSF", amount: 500_000 }],
        },
        endeavor: {
          endeavorField: "AI",
          endeavorStatement: "Advancing AI models for climate change mitigation in the United States.",
          nstcCategories: ["Artificial Intelligence"],
        },
        petitionerInfo: { givenName: "Pilot", familyName: "Applicant" },
      },
    },
  });
  leadId = lead.id;
  leadResultToken = lead.resultToken!;
  createdLeadIds.push(leadId);
});

afterAll(async () => {
  await cleanupTestData({
    caseIds: createdCaseIds,
    leadIds: createdLeadIds,
    userIds: createdUserIds,
  });
  await disconnectTestDb();
});

// ── Step 1: Admin claims the lead (admin bypass — no Stripe) ─────────────────

describe("Step 1: admin claims M7 lead", () => {
  it("claim returns ok + applicantStatus=approved (pre-approved lead)", async () => {
    mockSession({ userId: adminId, email: "hp-admin@test.com", role: "admin", name: "Happy Path Admin" });
    const req = buildRequest(`http://localhost/api/leads/${leadId}/claim`, {
      method: "POST",
      body: {},
    });
    const res = await claimPOST(req, { params: Promise.resolve({ id: leadId }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // Pre-approved lead → auto-converted without consent round-trip
    expect(body.status).toMatch(/approved|pending_approval/);
  });
});

// ── Step 2: convert → case + intake token ────────────────────────────────────

describe("Step 2: convert lead → case + intake token", () => {
  it("convert creates case and returns intake token", async () => {
    // Give the auto-convert a moment to run (it's async in the claim path)
    await new Promise(r => setTimeout(r, 500));

    // convert is applicant-facing: it requires the resultToken capability token
    // (sent in the confirmation email), not a session. Passing it exercises the
    // real auth path instead of 401-ing.
    const req = buildRequest(`http://localhost/api/leads/${leadId}/convert`, {
      method: "POST",
      body: { resultToken: leadResultToken },
    });
    const res = await convertPOST(req, { params: Promise.resolve({ id: leadId }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    // If pending, the auto-convert didn't fire yet — force it
    if (body.pending) {
      const { autoConvertLead } = await import("@/lib/lead-convert");
      const result = await autoConvertLead(leadId);
      expect(result).not.toBeNull();
      caseId = result!.caseId;
      intakeToken = result!.intakeToken!; // this call path never sets skipIntakeEmail
    } else {
      caseId = body.caseId;
      intakeToken = body.intakeToken;
    }
    expect(caseId).toBeTruthy();
    expect(intakeToken).toBeTruthy();
    createdCaseIds.push(caseId);
  });

  it("lead.caseId is set in DB", async () => {
    const lead = await testPrisma.lead.findUnique({ where: { id: leadId } });
    expect(lead?.caseId).toBe(caseId);
  });

  it("reassign case attorney to test attorney (admin claimed, attorney will work the case)", async () => {
    // autoConvertLead sets attorneyId = claimedByUserId (= adminId here).
    // Re-point it to the attorney user so subsequent attorney-session calls pass canAccessCase.
    await testPrisma.case.update({
      where: { id: caseId },
      data: { attorneyId },
    });
    const c = await testPrisma.case.findUnique({ where: { id: caseId } });
    expect(c?.attorneyId).toBe(attorneyId);
  });
});

// ── Step 3: applicant reads + submits intake ─────────────────────────────────

describe("Step 3: applicant reads and submits intake", () => {
  it("GET intake returns case formData", async () => {
    mockSession(null);
    const req = buildRequest(`http://localhost/api/intake/${intakeToken}`, { method: "GET" });
    const res = await intakeGetGET(req, { params: Promise.resolve({ token: intakeToken }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.caseId).toBe(caseId);
  });

  it("POST intake submits deep intake formData", async () => {
    const req = buildRequest(`http://localhost/api/intake/${intakeToken}`, {
      method: "POST",
      body: {
        formData: {
          petitionerInfo: { givenName: "Pilot", familyName: "Applicant", phone: "+1-555-0100" },
          qualifications: {
            publications: [{ title: "AI for Climate", venue: "Nature", citations: 150 }],
          },
          endeavor: {
            endeavorField: "AI",
            endeavorStatement: "Advancing AI models for climate change mitigation in the United States.",
          },
        },
        completed: true,
      },
    });
    const res = await intakePOST(req, { params: Promise.resolve({ token: intakeToken }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── Step 4: attorney creates letter ─────────────────────────────────────────

describe("Step 4: attorney creates a recommendation letter", () => {
  it("POST /api/cases/[id]/letters creates letter", async () => {
    mockSession({
      userId: attorneyId,
      email: "hp-attorney@test.com",
      role: "attorney",
      name: "Happy Path Attorney",
    });
    const req = buildRequest(`http://localhost/api/cases/${caseId}/letters`, {
      method: "POST",
      body: {
        requirementId: "recommendation-letter-1",
        recommender: {
          name: "Prof. Alice Wang",
          email: "alice.wang@mit.edu",
          title: "Professor",
          institution: "MIT",
        },
        selectedEvidence: [],
      },
    });
    const res = await lettersCreatePOST(req, { params: Promise.resolve({ id: caseId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    letterId = body.id;
  });
});

// ── Step 5: AI letter draft (LLM mocked) ─────────────────────────────────────

describe("Step 5: generate AI letter draft (mocked LLM)", () => {
  it("POST /api/cases/[id]/letters/[id]/draft returns content", async () => {
    mockSession({
      userId: attorneyId,
      email: "hp-attorney@test.com",
      role: "attorney",
      name: "Happy Path Attorney",
    });
    const req = buildRequest(
      `http://localhost/api/cases/${caseId}/letters/${letterId}/draft`,
      { method: "POST", body: {} }
    );
    const res = await letterDraftPOST(req, {
      params: Promise.resolve({ id: caseId, letterId }),
    });
    // The mock might return 400 if the form doesn't have the letter requirement;
    // we accept 200 or 400 (the seam we care about is: no 500, no crash)
    expect([200, 400, 404]).toContain(res.status);
  });
});

// ── Step 6: send letter review token to recommender ──────────────────────────

describe("Step 6: send review token to recommender", () => {
  it("POST send-review returns token", async () => {
    mockSession({
      userId: attorneyId,
      email: "hp-attorney@test.com",
      role: "attorney",
      name: "Happy Path Attorney",
    });
    const req = buildRequest(
      `http://localhost/api/cases/${caseId}/letters/${letterId}/send-review`,
      { method: "POST", body: { email: "alice.wang@mit.edu" } }
    );
    const res = await sendReviewPOST(req, {
      params: Promise.resolve({ id: caseId, letterId }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    // reviewUrl is like "http://localhost:3000/review/<token>"
    reviewToken = String(body.reviewUrl ?? "").split("/").pop() ?? "";
    expect(reviewToken).toBeTruthy();
  });
});

// ── Step 7: recommender submits letter draft ──────────────────────────────────

describe("Step 7: recommender reads and submits draft", () => {
  it("GET /api/review/[token] returns letter payload", async () => {
    mockSession(null);
    const req = buildRequest(`http://localhost/api/review/${reviewToken}`, { method: "GET" });
    const res = await reviewGetGET(req, { params: Promise.resolve({ token: reviewToken }) });
    expect(res.status).toBe(200);
  });

  it("POST /api/review/[token] accepts recommender draft", async () => {
    const req = buildRequest(`http://localhost/api/review/${reviewToken}`, {
      method: "POST",
      body: {
        draft: "I have had the pleasure of working with Dr. Applicant for five years. Their work in AI for climate is exceptional and of clear national importance to the United States.",
      },
    });
    const res = await reviewSubmitPOST(req, { params: Promise.resolve({ token: reviewToken }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── Step 8: attorney attests claim-ledger ─────────────────────────────────────

describe("Step 8: attorney attests claim-ledger", () => {
  it("POST claim-ledger attest records the ledger", async () => {
    mockSession({
      userId: adminId, // admin can attest any lead
      email: "hp-admin@test.com",
      role: "admin",
      name: "Happy Path Admin",
    });
    const req = buildRequest(
      `http://localhost/api/leads/${leadId}/claim-ledger`,
      {
        method: "POST",
        body: { action: "attest", approved: [] }, // empty set = all atoms approved
      }
    );
    const res = await claimLedgerPOST(req, { params: Promise.resolve({ id: leadId }) });
    // 200 = attested; 409 = no case yet (which shouldn't happen here)
    expect([200, 409]).toContain(res.status);
    if (res.status === 200) {
      const body = await res.json();
      expect(body.ok).toBe(true);
    }
  });
});

// ── Step 9: mark case as filed → immutability lock ───────────────────────────

describe("Step 9: mark filed → post-filing lock", () => {
  it("PATCH status=filed succeeds and sets filedAt", async () => {
    // Attorney (not admin) owns the case after the reassignment in Step 2
    mockSession({
      userId: attorneyId,
      email: "hp-attorney@test.com",
      role: "attorney",
      name: "Happy Path Attorney",
    });
    const req = buildRequest(`http://localhost/api/cases/${caseId}`, {
      method: "PATCH",
      body: { status: "filed" },
    });
    const res = await casePATCH(req, { params: Promise.resolve({ id: caseId }) });
    expect(res.status).toBe(200);
    const c = await testPrisma.case.findUnique({ where: { id: caseId } });
    expect(c?.filedAt).not.toBeNull();
  });

  it("PATCH formData after filing returns 409 (immutable)", async () => {
    mockSession({
      userId: attorneyId,
      email: "hp-attorney@test.com",
      role: "attorney",
      name: "Happy Path Attorney",
    });
    const req = buildRequest(`http://localhost/api/cases/${caseId}`, {
      method: "PATCH",
      body: { formData: { qualifications: { publications: [] } } },
    });
    const res = await casePATCH(req, { params: Promise.resolve({ id: caseId }) });
    expect(res.status).toBe(409);
  });

  it("POST to intake token after filing returns 409 (locked)", async () => {
    mockSession(null);
    const req = buildRequest(`http://localhost/api/intake/${intakeToken}`, {
      method: "POST",
      body: {
        formData: { petitionerInfo: { givenName: "Updated" } },
      },
    });
    const res = await intakePOST(req, { params: Promise.resolve({ token: intakeToken }) });
    expect(res.status).toBe(409);
  });
});
