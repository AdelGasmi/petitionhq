/**
 * Integration tests — /api/leads
 *
 * POST: public lead capture (Turnstile mocked)
 * GET:  admin-only lead listing with filters
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  testPrisma,
  buildRequest,
  mockSession,
  setupAuthMock,
  setupTurnstileMock,
  createTestUser,
  cleanupTestData,
  disconnectTestDb,
} from "./helpers";

setupAuthMock();
setupTurnstileMock();

const { POST, GET } = await import("@/app/api/leads/route");
const { POST: reassessPOST } = await import("@/app/api/leads/[id]/reassess/route");
const { sendLeadConfirmation } = await import("@/lib/email");
const mockedConfirmation = vi.mocked(sendLeadConfirmation);

// Also mock email sending — we don't want real emails in tests
vi.mock("@/lib/email", () => ({
  sendLeadConfirmation: vi.fn(() => Promise.resolve()),
  sendLeadAdminAlert: vi.fn(() => Promise.resolve()),
  sendNurtureEmail: vi.fn(() => Promise.resolve()),
}));

let adminUser: { id: string; email: string };
const createdLeadIds: string[] = [];

beforeAll(async () => {
  adminUser = await createTestUser({ role: "admin", email: `leads-admin-${Date.now()}@test.com` });
});

afterAll(async () => {
  await cleanupTestData({
    userIds: [adminUser.id],
    leadIds: createdLeadIds,
  });
  await disconnectTestDb();
});

describe("POST /api/leads", () => {
  it("creates a new lead with valid data", async () => {
    const email = `new-lead-${Date.now()}@test.com`;
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: {
        email,
        name: "Jane Smith",
        tier: "Strong",
        score: 85,
        formData: { field: "Computer Science", degree: "PhD" },
        source: "check",
        turnstileToken: "test-token",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.leadId).toBeTruthy();
    createdLeadIds.push(data.leadId);

    // Verify in DB
    const lead = await testPrisma.lead.findUnique({ where: { id: data.leadId } });
    expect(lead).not.toBeNull();
    expect(lead!.email).toBe(email);
    expect(lead!.tier).toBe("tier1"); // "Strong" → tier1
    expect(lead!.score).toBe(85);
    expect(lead!.name).toBe("Jane Smith");
  });

  it("returns existing leadId on duplicate email (allows re-assessment)", async () => {
    const email = `dup-${Date.now()}@test.com`;

    const req1 = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { email, name: "Dup User", score: 50, tier: "Borderline", turnstileToken: "t" },
    });
    const res1 = await POST(req1);
    const data1 = await res1.json();
    createdLeadIds.push(data1.leadId);
    expect(res1.status).toBe(200);

    // Second create with same email — should return same leadId, not 409
    const req2 = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { email, score: 90, tier: "Strong", name: "Updated Name", turnstileToken: "t" },
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.leadId).toBe(data1.leadId);
  });

  it("returns existing leadId on duplicate email case-insensitively", async () => {
    const email = `CaseTest-${Date.now()}@Test.com`;

    const req1 = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { email, name: "Case Tester", score: 80, tier: "Strong", turnstileToken: "t" },
    });
    const res1 = await POST(req1);
    const data1 = await res1.json();
    createdLeadIds.push(data1.leadId);
    expect(res1.status).toBe(200);

    // Same email, different case — same leadId returned
    const req2 = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { email: email.toLowerCase(), name: "Case Tester", score: 80, tier: "Strong", turnstileToken: "t" },
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.leadId).toBe(data1.leadId);
  });

  it("returns 400 if email is missing", async () => {
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { score: 50, turnstileToken: "t" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("ignores LLM tier labels — classifies by score only", async () => {
    const email = `label-ignored-${Date.now()}@test.com`;
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { email, name: "Label Tester", tier: "Strong", score: 40, turnstileToken: "t" },
    });
    const res = await POST(req);
    const data = await res.json();
    createdLeadIds.push(data.leadId);

    const lead = await testPrisma.lead.findUnique({ where: { id: data.leadId } });
    expect(lead!.tier).toBe("tier3");
  });

  it("classifies tiers correctly by score when no label", async () => {
    const tests = [
      { score: 85, expected: "tier1" },
      { score: 75, expected: "tier1" },
      { score: 68, expected: "tier2" },
      { score: 50, expected: "tier2" },
      { score: 49, expected: "tier3" },
      { score: 20, expected: "tier3" },
    ];

    for (const t of tests) {
      const email = `score-${t.score}-${Date.now()}@test.com`;
      const req = buildRequest("http://localhost:3000/api/leads", {
        method: "POST",
        body: { email, name: "Score Tester", score: t.score, turnstileToken: "t" },
      });
      const res = await POST(req);
      const data = await res.json();
      createdLeadIds.push(data.leadId);

      const lead = await testPrisma.lead.findUnique({ where: { id: data.leadId } });
      expect(lead!.tier).toBe(t.expected);
    }
  });

  it("rejects a lead with no name (data-quality gate)", async () => {
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: { email: `noname-${Date.now()}@test.com`, score: 80, turnstileToken: "t" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("clamps an inflated client score to the evidence ceiling (empty profile → early)", async () => {
    const email = `inflated-${Date.now()}@test.com`;
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: {
        email,
        name: "Empty Profile",
        score: 95, // client-claimed, inflated — must NOT be trusted
        tier: "Strong",
        formData: { degree: "PhD", publications: "None", citations: "None or unknown" },
        turnstileToken: "t",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    createdLeadIds.push(data.leadId);

    const lead = await testPrisma.lead.findUnique({ where: { id: data.leadId } });
    expect(lead!.score).toBe(35); // evidence ceiling, not the client's 95
    expect(lead!.tier).toBe("tier3"); // early — never tier1 for an empty profile
  });
});

describe("GET /api/leads", () => {
  it("returns 401 for unauthenticated requests", async () => {
    mockSession(null);
    const req = buildRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 401 for non-admin users", async () => {
    mockSession({
      userId: "some-id",
      email: "attorney@test.com",
      role: "attorney",
      name: "Attorney",
    });
    const req = buildRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns leads list for admin", async () => {
    mockSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "admin",
      name: "Admin",
    });
    const req = buildRequest("http://localhost:3000/api/leads");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.leads).toBeDefined();
    expect(Array.isArray(data.leads)).toBe(true);
  });

  it("filters by tier", async () => {
    mockSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "admin",
      name: "Admin",
    });
    const req = buildRequest("http://localhost:3000/api/leads?tier=tier1");
    const res = await GET(req);
    const data = await res.json();
    expect(data.leads.every((l: { tier: string }) => l.tier === "tier1")).toBe(true);
  });

  it("returns CSV format", async () => {
    mockSession({
      userId: adminUser.id,
      email: adminUser.email,
      role: "admin",
      name: "Admin",
    });
    const req = buildRequest("http://localhost:3000/api/leads?format=csv");
    const res = await GET(req);
    expect(res.headers.get("content-type")).toContain("text/csv");
    const text = await res.text();
    // CSV no longer includes PII columns (email, name) — zero-trust admin
    expect(text).toContain("id,tier,score,status");
    expect(text).not.toContain("email");
    expect(text).not.toContain("name");
  });
});

describe("confirmation email reconciliation (preliminary vs final)", () => {
  const dims = (importance: number, waiver: number) => [
    { label: "EB-2 Baseline", score: 90, notes: "" },
    { label: "Prong 1 — Substantial Merit", score: 65, notes: "" },
    { label: "Prong 1 — National Importance", score: importance, notes: "" },
    { label: "Prong 2 — Well Positioned", score: 60, notes: "" },
    { label: "Prong 3 — Waiver Justified", score: waiver, notes: "" },
  ];

  async function createLead() {
    const email = `recon-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: {
        email,
        name: "Recon Tester",
        tier: "Developing",
        score: 68,
        dimensions: dims(65, 65),
        formData: { field: "AI", degree: "PhD", publications: "4–10", citations: "51–200" },
        source: "check",
        turnstileToken: "test-token",
      },
    });
    const res = await POST(req);
    const data = await res.json();
    createdLeadIds.push(data.leadId);
    return { leadId: data.leadId as string, resultToken: data.resultToken as string };
  }

  function reassessReq(leadId: string, body: Record<string, unknown>) {
    const req = buildRequest(`http://localhost:3000/api/leads/${leadId}/reassess`, {
      method: "POST",
      body,
    });
    return reassessPOST(req, { params: Promise.resolve({ id: leadId }) });
  }

  it("flags the gate (5-question) email as preliminary", async () => {
    mockedConfirmation.mockClear();
    await createLead();
    expect(mockedConfirmation).toHaveBeenCalledTimes(1);
    expect(mockedConfirmation.mock.calls[0][0]).toMatchObject({ isPreliminary: true });
  });

  it("sends the authoritative final email when deep evidence lands", async () => {
    const { leadId, resultToken } = await createLead();
    mockedConfirmation.mockClear();
    const res = await reassessReq(leadId, {
      resultToken,
      formData: {
        field: "AI",
        degree: "PhD",
        publications: "4–10",
        citations: "51–200",
        employerSituation: "Has an employer who could sponsor",
        usPlan: "general field or type of work",
        _dimensions: dims(40, 35),
        _summary: "Honest deep read.",
        _gapNarrative: { strengths: ["s1"], blockers: ["b1"], legalLeverage: ["l1"] },
      },
    });
    expect(res.status).toBe(200);
    expect(mockedConfirmation).toHaveBeenCalledTimes(1);
    const arg = mockedConfirmation.mock.calls[0][0];
    expect(arg).toMatchObject({ isPreliminary: false });
    // Carries the SAME harsh dimensions the result page renders.
    expect((arg.dimensions ?? []).find((d) => d.label.includes("Waiver"))?.score).toBe(35);
    expect(arg.gapNarrative).toMatchObject({ strengths: "s1", blockers: "b1", legalLeverage: "l1" });
  });

  it("does NOT re-email on a light-only reassess (decline / re-check)", async () => {
    const { leadId, resultToken } = await createLead();
    mockedConfirmation.mockClear();
    const res = await reassessReq(leadId, {
      resultToken,
      formData: {
        field: "AI",
        degree: "PhD",
        publications: "4–10",
        citations: "51–200",
        _dimensions: dims(65, 65),
        _summary: "Preliminary persisted on decline.",
      },
    });
    expect(res.status).toBe(200);
    expect(mockedConfirmation).not.toHaveBeenCalled();
  });
});
