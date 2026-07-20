import { prisma } from "./prisma";
import type { SessionPayload } from "./auth";

export type ActivityAction =
  | "case.created"
  | "case.deleted"
  | "case.status_changed"
  | "case.attorney_assigned"
  | "case.attorney_removed"
  | "case.review_requested"
  | "case.review_responded"
  | "letter.drafted"
  | "letter.deleted"
  | "letter.review_sent"
  | "letter.review_submitted"
  | "case.viewed"
  | "document.uploaded"
  | "document.downloaded"
  | "document.deleted"
  | "message.sent"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "lead.result_viewed"
  | "lead.consented"
  | "lead.claimed"
  | "lead.claim_initiated"
  | "lead.released"
  | "lead.deleted"
  | "lead.pilot_ghost_released"
  | "intake.completed"
  | "firm.suspended"
  | "firm.unsuspended"
  | "firm.tier_changed"
  | "refund.requested"
  | "refund.approved"
  | "refund.denied"
  | "claim_ledger_attested"
  | "brief.exported_with_unverified_claims"
  | "lead.attested"
  | "lead.dossier_requeued"
  | "lead.beta_converted"
  | "lead.beta_reversed"
  | "user.beta_deactivated"
  | "attorney_terms.accepted";

export async function logActivity(opts: {
  actor?: SessionPayload | null;
  caseId?: string;
  caseTitle?: string;
  action: ActivityAction;
  detail?: string;
}) {
  try {
    await prisma.activityLog.create({
      data: {
        actorId:   opts.actor?.userId,
        actorName: opts.actor?.name,
        actorRole: opts.actor?.role,
        caseId:    opts.caseId,
        caseTitle: opts.caseTitle,
        action:    opts.action,
        detail:    opts.detail,
      },
    });
  } catch {
    // Never let logging break the actual operation
  }
}

export type ActivityEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  caseId: string | null;
  caseTitle: string | null;
  action: string;
  detail: string | null;
  createdAt: string;
};

export async function listActivity(limit = 100): Promise<ActivityEntry[]> {
  const rows = await prisma.activityLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}
