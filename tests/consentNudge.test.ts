import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Consent-nudge trigger guards (`POST /api/cron/consent-nudge`): auth gate,
 * dry-run sends nothing, send-once dedupe against EmailLog, and the happy
 * path. SMTP delivery itself is exercised on prod with ?leadId= against a
 * synthetic lead, not here.
 */

vi.mock("@/lib/email", () => ({ sendConsentNudge: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/funnel", () => ({ trackFunnel: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findMany: vi.fn() },
    emailLog: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import { sendConsentNudge } from "@/lib/email";

const SECRET = "test-cron-secret";

function req(query = "", withAuth = true) {
  return new NextRequest(`http://localhost/api/cron/consent-nudge${query}`, {
    method: "POST",
    headers: withAuth ? { authorization: `Bearer ${SECRET}` } : {},
  });
}

const LEAD = {
  id: "lead_1",
  email: "applicant@example.com",
  name: "Test Applicant",
  resultToken: "tok_abc",
  formData: { field: "Machine Learning" },
  trustScore: 80,
};

async function route() {
  // CRON_SECRET is read at module load — set env, then (re)import fresh.
  process.env.CRON_SECRET = SECRET;
  vi.resetModules();
  return await import("@/app/api/cron/consent-nudge/route");
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/cron/consent-nudge", () => {
  it("401s without the bearer secret", async () => {
    const { POST } = await route();
    const res = await POST(req("", false));
    expect(res.status).toBe(401);
    expect(sendConsentNudge).not.toHaveBeenCalled();
  });

  it("dryRun reports would-send without sending", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([LEAD] as never);
    vi.mocked(prisma.emailLog.findFirst).mockResolvedValue(null as never);
    const { POST } = await route();
    const res = await POST(req("?dryRun=1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, dryRun: true, eligible: 1, sent: 0 });
    expect(body.results).toEqual([{ id: "lead_1", status: "would-send" }]);
    expect(sendConsentNudge).not.toHaveBeenCalled();
  });

  it("sends once and never re-nudges (EmailLog dedupe)", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([LEAD] as never);
    vi.mocked(prisma.emailLog.findFirst).mockResolvedValue({ id: "log_1" } as never);
    const { POST } = await route();
    const res = await POST(req());
    const body = await res.json();
    expect(body.sent).toBe(0);
    expect(body.results).toEqual([{ id: "lead_1", status: "already-nudged" }]);
    expect(sendConsentNudge).not.toHaveBeenCalled();
  });

  it("happy path sends the nudge with field + token", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([LEAD] as never);
    vi.mocked(prisma.emailLog.findFirst).mockResolvedValue(null as never);
    const { POST } = await route();
    const res = await POST(req());
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, sent: 1, skipped: 0 });
    expect(sendConsentNudge).toHaveBeenCalledWith({
      to: "applicant@example.com",
      name: "Test Applicant",
      field: "Machine Learning",
      resultToken: "tok_abc",
    });
  });

  it("skips leads with no email or resultToken", async () => {
    vi.mocked(prisma.lead.findMany).mockResolvedValue([
      { ...LEAD, id: "lead_2", email: null },
    ] as never);
    const { POST } = await route();
    const body = await (await POST(req())).json();
    expect(body.skipped).toBe(1);
    expect(sendConsentNudge).not.toHaveBeenCalled();
  });
});
