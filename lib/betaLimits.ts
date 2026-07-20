import { prisma } from "./prisma";

/**
 * Self-petitioner beta cost guardrail (petitionhq/beta_onboarding_plan.md
 * Phase 2.4). Scoped to the applicant's own self-serve drafting — the
 * founder-attorney concierge path is unmetered (trusted operator, their own
 * judgment on spend). Covers the whole drafting surface (letters, brief
 * sections, assessments, coherence) via LlmUsage — the same per-call cost
 * ledger the admin leads page already sums for its "cost" column — rather
 * than counting drafts on one specific route.
 */
export const BETA_CASE_COST_CAP_CENTS = 200; // $2.00 per case

export const BETA_LIMIT_MESSAGE = "Beta limit reached — reply to us and we'll help you finish this.";

export async function betaCaseCostCents(caseId: string): Promise<number> {
  const agg = await prisma.llmUsage.aggregate({ where: { caseId }, _sum: { cents: true } });
  return agg._sum.cents ?? 0;
}

export async function betaCostCapReached(caseId: string): Promise<boolean> {
  return (await betaCaseCostCents(caseId)) >= BETA_CASE_COST_CAP_CENTS;
}
