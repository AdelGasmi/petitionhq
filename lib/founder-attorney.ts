import { prisma } from "./prisma";

const DEFAULT_FOUNDER_ATTORNEY_EMAIL = "attorney@petitionhq.us";

/**
 * The attorney account that operates the self-petitioner beta's concierge
 * lane (see petitionhq/beta_onboarding_plan.md §3.2). Internal role label
 * only — never presented to users as counsel.
 */
export async function getFounderAttorney() {
  const email = (process.env.FOUNDER_ATTORNEY_EMAIL ?? DEFAULT_FOUNDER_ATTORNEY_EMAIL).toLowerCase();
  return prisma.user.findFirst({ where: { email, role: "attorney" } });
}
