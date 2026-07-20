import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import logger from "./logger";

/**
 * Fire-and-forget funnel event tracking.
 * Never throws — failures are logged but don't break the caller.
 */
export function trackFunnel(opts: {
  event: string;
  sessionId?: string | null;
  userId?: string | null;
  leadId?: string | null;
  props?: Record<string, unknown>;
}): void {
  prisma.funnelEvent
    .create({
      data: {
        event: opts.event,
        sessionId: opts.sessionId ?? undefined,
        userId: opts.userId ?? undefined,
        leadId: opts.leadId ?? undefined,
        props: (opts.props ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    })
    .catch((e) => logger.error("[funnel]", e));
}

/** All recognized funnel event names — used by the admin page for ordering. */
export const FUNNEL_STEPS = [
  "check.started",
  "check.bounced",
  "check.completed",
  "lead.email_submitted",
  "verification.preliminary_completed",
  "verification.teaser_clicked",
  "verification.deep_started",
  "verification.deep_completed",
  "verification.contradiction_flagged",
  "lead.consent_given",
  "dossier.generated",
  "lead.attorney_notified",
  "lead.claimed",
  "lead.applicant_approved",
  "lead.applicant_rejected",
  "pilot.lead_delivered",
  "pilot.outcome_updated",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

/** Human-readable labels for the admin funnel page */
export const FUNNEL_LABELS: Record<string, string> = {
  "check.started": "Check started",
  "check.bounced": "Check bounced",
  "check.completed": "Check completed",
  "lead.email_submitted": "Email submitted",
  "verification.preliminary_completed": "Verification ping",
  "verification.teaser_clicked": "Teaser clicked",
  "verification.deep_started": "Deep verification started",
  "verification.deep_completed": "Deep verification completed",
  "verification.contradiction_flagged": "Contradiction flagged",
  "lead.consent_given": "Consent given",
  "dossier.generated": "Dossier generated",
  "lead.attorney_notified": "Attorney notified",
  "lead.claimed": "Lead claimed",
  "lead.applicant_approved": "Applicant approved",
  "lead.applicant_rejected": "Applicant rejected",
  "pilot.lead_delivered": "Pilot: lead delivered",
  "pilot.outcome_updated": "Pilot: outcome updated",
  // Grounding-gate telemetry (A2 follow-up)
  "export.clean": "Export — no flags",
  "export.gate_triggered": "Export gate triggered",
  "export.gate_overridden": "Export gate overridden",
};
