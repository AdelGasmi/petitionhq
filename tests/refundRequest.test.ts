import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Deterministic refund-request guards — the parts of the refund flow that can be
 * tested without a live Stripe call. Covers the attorney-initiated request route
 * (`POST /api/cases/[id]/refund-request`): role gate, pilot non-refundable,
 * ownership, the 30-day window, and duplicate-pending rejection.
 *
 * The Stripe-side of the flow (admin approve → stripe.refunds.create → lead
 * reset, ghost cron, and the charge.refunded webhook reconciliation) requires a
 * real test-mode payment and is exercised via the manual checklist in
 * pre_launch_readiness.md, not here.
 */

vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendRefundRequestAdminAlert: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    firmProfile: { findUnique: vi.fn() },
    case: { findUnique: vi.fn() },
    lead: { findFirst: vi.fn() },
    leadClaimPayment: { findFirst: vi.fn() },
    refundRequest: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

import { POST } from "@/app/api/cases/[id]/refund-request/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CASE_ID = "case_1";
const ATTY = "atty_1";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/cases/case_1/refund-request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
const params = { params: Promise.resolve({ id: CASE_ID }) };

const session = (over: Record<string, unknown> = {}) =>
  ({ userId: ATTY, role: "attorney", name: "Atty One", ...over });

/** Wire the happy-path DB stubs; individual tests override pieces to fail. */
function wireHappyPath(claimedDaysAgo: number) {
  (getSession as any).mockResolvedValue(session());
  (prisma.firmProfile.findUnique as any).mockResolvedValue({ networkTier: "standard" });
  (prisma.case.findUnique as any).mockResolvedValue({ id: CASE_ID, attorneyId: ATTY, title: "Matter" });
  (prisma.lead.findFirst as any).mockResolvedValue({
    id: "lead_1",
    claimedAt: new Date(Date.now() - claimedDaysAgo * 24 * 60 * 60 * 1000),
    claimedByUserId: ATTY,
  });
  (prisma.leadClaimPayment.findFirst as any).mockResolvedValue({
    id: "pay_1",
    stripeSessionId: "cs_test_1",
    amountCents: 15000,
  });
  (prisma.refundRequest.findFirst as any).mockResolvedValue(null);
  (prisma.refundRequest.create as any).mockResolvedValue({ id: "rr_1" });
}

describe("POST /api/cases/[id]/refund-request", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-attorneys (401)", async () => {
    (getSession as any).mockResolvedValue(session({ role: "admin" }));
    const res = await POST(req({ reason: "applicant_ghost", explanation: "x".repeat(20) }), params);
    expect(res.status).toBe(401);
  });

  it("rejects pilot-tier claims as non-refundable (403)", async () => {
    (getSession as any).mockResolvedValue(session());
    (prisma.firmProfile.findUnique as any).mockResolvedValue({ networkTier: "pilot" });
    const res = await POST(req({ reason: "applicant_ghost", explanation: "x".repeat(20) }), params);
    expect(res.status).toBe(403);
  });

  it("rejects a non-owning attorney (403)", async () => {
    wireHappyPath(1);
    (prisma.case.findUnique as any).mockResolvedValue({ id: CASE_ID, attorneyId: "someone_else", title: "Matter" });
    const res = await POST(req({ reason: "applicant_ghost", explanation: "x".repeat(20) }), params);
    expect(res.status).toBe(403);
  });

  it("enforces the 30-day window (409 when claimed 31 days ago)", async () => {
    wireHappyPath(31);
    const res = await POST(req({ reason: "material_misrepresentation", explanation: "x".repeat(20) }), params);
    expect(res.status).toBe(409);
  });

  it("rejects an invalid reason (400)", async () => {
    wireHappyPath(1);
    const res = await POST(req({ reason: "because", explanation: "x".repeat(20) }), params);
    expect(res.status).toBe(400);
  });

  it("rejects a too-short explanation (400)", async () => {
    wireHappyPath(1);
    const res = await POST(req({ reason: "applicant_ghost", explanation: "short" }), params);
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate pending request (409)", async () => {
    wireHappyPath(1);
    (prisma.refundRequest.findFirst as any).mockResolvedValue({ id: "rr_existing", status: "pending" });
    const res = await POST(req({ reason: "applicant_ghost", explanation: "x".repeat(20) }), params);
    expect(res.status).toBe(409);
  });

  it("accepts a valid in-window request and creates a RefundRequest", async () => {
    wireHappyPath(5);
    const res = await POST(req({ reason: "material_misrepresentation", explanation: "Profile overstated citations." }), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, status: "pending" });
    expect(prisma.refundRequest.create).toHaveBeenCalledOnce();
  });
});
