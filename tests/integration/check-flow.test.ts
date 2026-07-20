/**
 * Integration tests — the /check funnel end-to-end
 *
 * Simulates the actual user flow:
 * 1. POST /api/check with answers → get assessment result
 * 2. POST /api/leads with result → create lead
 * 3. POST /api/leads/[id]/consent → opt in to matching
 *
 * Turnstile is mocked (tested separately in unit tests).
 * LLM is mocked to return deterministic results.
 */

import { describe, it, expect, afterAll, vi } from "vitest";
import {
  testPrisma,
  buildRequest,
  setupTurnstileMock,
  cleanupTestData,
  disconnectTestDb,
} from "./helpers";

setupTurnstileMock();

// Mock LLM — return a fixed assessment so tests don't need a real API key
vi.mock("@/lib/lmstudio", () => ({
  complete: vi.fn(() =>
    Promise.resolve("not used")
  ),
  completeStream: vi.fn(),
  completeStructured: vi.fn(() =>
    Promise.resolve({
      score: 77,
      tier: "Strong",
      eb2Path: "advanced-degree",
      summary: "Strong profile with solid publication record.",
      dimensions: [
        { label: "EB-2 Baseline", score: 90, notes: "PhD qualifies." },
        { label: "Prong 1 — Substantial Merit", score: 80, notes: "AI field." },
        { label: "Prong 1 — National Importance", score: 75, notes: "Moderate impact." },
        { label: "Prong 2 — Well Positioned", score: 70, notes: "Good citations." },
        { label: "Prong 3 — Waiver Justified", score: 75, notes: "Standard." },
      ],
      gaps: [
        { title: "Need more citations", description: "Increase citation count.", priority: "important" },
      ],
      gapNarrative: {
        strengths: ["PhD in CS", "10+ publications"],
        blockers: ["Limited industry impact evidence"],
        legalLeverage: ["Strong academic record for Dhanasar prong 1"],
      },
      readyToApply: false,
    })
  ),
  healthCheck: vi.fn(() => Promise.resolve({ ok: true, models: ["test"] })),
}));

// Mock email
vi.mock("@/lib/email", () => ({
  sendLeadConfirmation: vi.fn(() => Promise.resolve()),
  sendLeadAdminAlert: vi.fn(() => Promise.resolve()),
  sendConsentConfirmation: vi.fn(() => Promise.resolve()),
}));

// Mock auth (leads POST is public, no session needed, but GET requires admin)
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(() => Promise.resolve(null)),
  requireSession: vi.fn(() => { throw new Error("Not authenticated"); }),
}));

const leadIds: string[] = [];

afterAll(async () => {
  await cleanupTestData({ leadIds });
  await disconnectTestDb();
});

describe("Check funnel end-to-end", () => {
  let assessmentResult: Record<string, unknown>;
  let leadId: string;
  let resultToken: string;

  it("Step 1: POST /api/check — returns NIW assessment", async () => {
    const { POST } = await import("@/app/api/check/route");

    const req = buildRequest("http://localhost:3000/api/check", {
      method: "POST",
      body: {
        degree: "PhD",
        field: "Computer Science",
        yearsExperience: "5–10 years",
        publications: "10+",
        citations: "100+",
        patents: "",
        awards: "",
        grants: "",
        peerReview: "",
        invitedTalks: "",
        nationalConnection: "",
        usPlan: "",
        employerSituation: "",
        turnstileToken: "test-token",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    assessmentResult = await res.json();
    expect(assessmentResult.score).toBe(77);
    expect(assessmentResult.tier).toBe("Strong");
    expect(assessmentResult.dimensions).toHaveLength(5);
    expect(assessmentResult.gapNarrative).toBeDefined();
    expect((assessmentResult.gapNarrative as { strengths: string[] }).strengths.length).toBeGreaterThan(0);
  });

  it("Step 2: POST /api/leads — saves lead with assessment data", async () => {
    const { POST } = await import("@/app/api/leads/route");

    const email = `e2e-check-${Date.now()}@test.com`;
    const req = buildRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: {
        email,
        name: "E2E Test User",
        tier: assessmentResult.tier,
        score: assessmentResult.score,
        formData: { degree: "PhD", field: "Computer Science" },
        source: "check",
        turnstileToken: "test-token",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.leadId).toBeTruthy();
    expect(data.resultToken).toBeTruthy();
    leadId = data.leadId;
    resultToken = data.resultToken;
    leadIds.push(leadId);

    // Verify lead in DB
    const lead = await testPrisma.lead.findUnique({ where: { id: leadId } });
    expect(lead).not.toBeNull();
    expect(lead!.email).toBe(email);
    expect(lead!.tier).toBe("tier1"); // "Strong" → tier1
    expect(lead!.score).toBe(77);
    expect(lead!.applicantStatus).toBe("unclaimed");
  });

  it("Step 3: POST /api/leads/[id]/consent — applicant opts in", async () => {
    const { POST } = await import("@/app/api/leads/[id]/consent/route");

    const req = buildRequest(`http://localhost:3000/api/leads/${leadId}/consent`, {
      method: "POST",
      body: { resultToken },
    });
    const res = await POST(req, { params: Promise.resolve({ id: leadId }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("approved");

    // Verify status change in DB
    const lead = await testPrisma.lead.findUnique({ where: { id: leadId } });
    expect(lead!.applicantStatus).toBe("approved");
  });

  it("Step 4: Verify complete funnel state", async () => {
    const lead = await testPrisma.lead.findUnique({ where: { id: leadId } });
    expect(lead).not.toBeNull();
    expect(lead!.tier).toBe("tier1");
    expect(lead!.score).toBe(77);
    expect(lead!.applicantStatus).toBe("approved");
    expect(lead!.source).toBe("check");
    expect(lead!.name).toBe("E2E Test User");
  });
});

describe("Check funnel error cases", () => {
  it("POST /api/check with empty answers still returns a result", async () => {
    const { POST } = await import("@/app/api/check/route");

    const req = buildRequest("http://localhost:3000/api/check", {
      method: "POST",
      body: {
        degree: "Bachelor's",
        field: "Business",
        yearsExperience: "Less than 2 years",
        publications: "",
        citations: "",
        patents: "",
        awards: "",
        grants: "",
        peerReview: "",
        invitedTalks: "",
        nationalConnection: "",
        usPlan: "",
        employerSituation: "",
        turnstileToken: "test-token",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("POST /api/check without turnstile token returns 403 when secret is set", async () => {
    // Restore real Turnstile for this one test
    const { verifyTurnstile } = await import("@/lib/turnstile");
    const mockFn = verifyTurnstile as unknown as ReturnType<typeof vi.fn>;
    mockFn.mockResolvedValueOnce(false); // Simulate failed verification

    const { POST } = await import("@/app/api/check/route");

    const req = buildRequest("http://localhost:3000/api/check", {
      method: "POST",
      body: {
        degree: "PhD",
        field: "CS",
        yearsExperience: "5–10 years",
        publications: "5",
        citations: "50",
        patents: "",
        awards: "",
        grants: "",
        peerReview: "",
        invitedTalks: "",
        nationalConnection: "",
        usPlan: "",
        employerSituation: "",
        // No turnstileToken!
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("CAPTCHA");
  });
});
