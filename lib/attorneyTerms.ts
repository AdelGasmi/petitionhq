/**
 * Attorney platform-terms acceptance (2026-07).
 *
 * Attorneys must accept the Attorney Platform Terms (rendered at
 * /attorney-terms and inside the network-shell gate) before using any
 * /network surface or executing legally significant actions (lead claim,
 * claim-ledger attestation). Acceptance is version-stamped: bumping
 * ATTORNEY_TERMS_VERSION forces every attorney through the gate again on
 * their next visit.
 */

export const ATTORNEY_TERMS_VERSION = "2026-07-05";

export function attorneyTermsCurrent(u: {
  attorneyTermsAcceptedAt: Date | string | null;
  attorneyTermsVersion: string | null;
}): boolean {
  return !!u.attorneyTermsAcceptedAt && u.attorneyTermsVersion === ATTORNEY_TERMS_VERSION;
}

/**
 * Server-side re-check for legally significant attorney actions (lead claim,
 * claim-ledger attestation). The /network layout gate is the primary UX;
 * this is defense in depth for direct API calls. Non-attorney roles pass
 * (admin has its own authz; this check is about *attorney* terms).
 */
export async function attorneyTermsAcceptedInDb(userId: string): Promise<boolean> {
  const { prisma } = await import("./prisma");
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { attorneyTermsAcceptedAt: true, attorneyTermsVersion: true },
  });
  return !!u && attorneyTermsCurrent(u);
}
