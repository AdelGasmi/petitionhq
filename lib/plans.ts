import { prisma } from "./prisma";

// ---------------------------------------------------------------------------
// Pricing model (V3 — 2026-05)
//
// Applicants: free. Unlimited cases, unlimited drafts, no gating, no plan.
// Attorneys:
//   - $99 USD / month for network seat (Stripe subscription).
//     Required to access /network features (lead marketplace, billing).
//   - $150 USD per lead claim (one-time Stripe Checkout at claim time).
//     Bundles: contact info reveal + case creation + AI drafting for that case.
//   - AI drafting: metered via DraftUsage table but NOT billed during beta.
// ---------------------------------------------------------------------------

export const PRICING = {
  seat: { amountUsd: 99, currency: "USD" as const, interval: "month" as const },
  leadClaim: { amountUsd: 150, currency: "USD" as const },
} as const;

/**
 * Check whether a firm has an active subscription.
 */
export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const firm = await prisma.firmProfile.findUnique({
    where: { userId },
    select: { subscriptionStatus: true },
  });
  return firm?.subscriptionStatus === "active";
}
