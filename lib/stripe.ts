import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe];
  },
});

/**
 * Pricing-V3 Stripe price IDs.
 *   STRIPE_PRICE_SEAT        — recurring monthly, $99 / attorney
 *   STRIPE_PRICE_LEAD_CLAIM  — one-time, $150 per lead claim
 */
export const STRIPE_PRICES = {
  seat:      process.env.STRIPE_PRICE_CASE_MGMT_SEAT ?? "",
  leadClaim: process.env.STRIPE_PRICE_CASE_NIW       ?? "",
};
