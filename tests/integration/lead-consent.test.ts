/**
 * Integration tests — POST /api/leads/[id]/consent
 *
 * Tests the upstream consent flow: unclaimed → approved.
 */

import { describe, it, expect, afterAll } from "vitest";
import {
  testPrisma,
  buildRequest,
  createTestLead,
  cleanupTestData,
  disconnectTestDb,
} from "./helpers";

const { POST } = await import("@/app/api/leads/[id]/consent/route");

const leadIds: string[] = [];

afterAll(async () => {
  await cleanupTestData({ leadIds });
  await disconnectTestDb();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/leads/[id]/consent", () => {
  it("transitions unclaimed lead to approved", async () => {
    const lead = await createTestLead({ email: `consent-1-${Date.now()}@test.com` });
    leadIds.push(lead.id);

    const req = buildRequest(`http://localhost:3000/api/leads/${lead.id}/consent`, {
      method: "POST",
      body: { resultToken: lead.resultToken },
    });
    const res = await POST(req, makeParams(lead.id));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("approved");

    // Verify in DB
    const updated = await testPrisma.lead.findUnique({ where: { id: lead.id } });
    expect(updated!.applicantStatus).toBe("approved");
  });

  it("is idempotent for already-approved lead", async () => {
    const lead = await createTestLead({ email: `consent-2-${Date.now()}@test.com` });
    leadIds.push(lead.id);

    // First consent
    await POST(
      buildRequest(`http://localhost:3000/api/leads/${lead.id}/consent`, {
        method: "POST",
        body: { resultToken: lead.resultToken },
      }),
      makeParams(lead.id),
    );

    // Second consent — should be idempotent
    const res = await POST(
      buildRequest(`http://localhost:3000/api/leads/${lead.id}/consent`, {
        method: "POST",
        body: { resultToken: lead.resultToken },
      }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("approved");
  });

  it("does not transition non-unclaimed leads", async () => {
    const lead = await createTestLead({ email: `consent-3-${Date.now()}@test.com` });
    leadIds.push(lead.id);

    // Manually set to "declined"
    await testPrisma.lead.update({
      where: { id: lead.id },
      data: { applicantStatus: "declined" },
    });

    const res = await POST(
      buildRequest(`http://localhost:3000/api/leads/${lead.id}/consent`, {
        method: "POST",
        body: { resultToken: lead.resultToken },
      }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("declined"); // unchanged
  });

  it("returns 404 for non-existent lead", async () => {
    const res = await POST(
      buildRequest("http://localhost:3000/api/leads/fake-id/consent", {
        method: "POST",
        body: { resultToken: "any-token" },
      }),
      makeParams("fake-id"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 without resultToken", async () => {
    const lead = await createTestLead({ email: `consent-noauth-${Date.now()}@test.com` });
    leadIds.push(lead.id);

    const res = await POST(
      buildRequest(`http://localhost:3000/api/leads/${lead.id}/consent`, { method: "POST" }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong resultToken", async () => {
    const lead = await createTestLead({ email: `consent-wrongtoken-${Date.now()}@test.com` });
    leadIds.push(lead.id);

    const res = await POST(
      buildRequest(`http://localhost:3000/api/leads/${lead.id}/consent`, {
        method: "POST",
        body: { resultToken: "wrong-token-000000000000000000000000000000000000000000000" },
      }),
      makeParams(lead.id),
    );
    expect(res.status).toBe(401);
  });
});
