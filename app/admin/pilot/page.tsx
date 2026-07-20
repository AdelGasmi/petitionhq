import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { legacyTierToCanonical, TIER_META } from "@/lib/scoring";
import { deriveCommercialFlags } from "@/lib/commercialFlags";
import { LEVEL_LABEL, type VerificationLevel } from "@/lib/verification/level";
import { Stat } from "@/components/Stat";
import { DeliverButton } from "./DeliverButton";
import { OutcomeSelect } from "./OutcomeSelect";
import { BetaDeactivateButton } from "@/components/BetaDeactivateButton";
import { BETA_CASE_COST_CAP_CENTS } from "@/lib/betaLimits";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  delivered: "Delivered",
  consult_booked: "Consult booked",
  signed: "Signed",
  rejected_junk: "Rejected",
};
const STATUS_COLOR: Record<string, string> = {
  delivered: "badge-neutral",
  consult_booked: "badge-info",
  signed: "badge-success",
  rejected_junk: "badge-danger",
};

export default async function PilotPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  // Consented leads with their outcomes
  const leads = await prisma.lead.findMany({
    where: { applicantStatus: "approved" },
    orderBy: { capturedAt: "desc" },
    select: {
      id: true,
      name: true,
      tier: true,
      score: true,
      trustScore: true,
      formData: true,
      verifiedClaims: true,
      capturedAt: true,
      outcomes: { orderBy: { deliveredAt: "desc" }, take: 1 },
    },
  });

  // Global funnel metrics for consent rate + ORCID rate
  const [totalLeads, orcidLeads] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { orcidAuthenticated: true } }),
  ]);
  const consentRate = totalLeads > 0 ? Math.round((leads.length / totalLeads) * 100) : 0;
  const orcidRate = totalLeads > 0 ? Math.round((orcidLeads / totalLeads) * 100) : 0;

  // Scorecard aggregates from outcomes
  const allOutcomes = await prisma.leadOutcome.findMany({
    select: { status: true, revenueCents: true, deliveredAt: true, updatedAt: true },
  });
  const totalDelivered = allOutcomes.length;
  const consultBooked = allOutcomes.filter((o) => ["consult_booked", "signed"].includes(o.status)).length;
  const signed = allOutcomes.filter((o) => o.status === "signed").length;
  const junk = allOutcomes.filter((o) => o.status === "rejected_junk").length;
  const totalRevenueCents = allOutcomes.reduce((sum, o) => sum + (o.revenueCents ?? 0), 0);
  const consultRate = totalDelivered > 0 ? Math.round((consultBooked / totalDelivered) * 100) : 0;
  const junkRate = totalDelivered > 0 ? Math.round((junk / totalDelivered) * 100) : 0;

  // Self-petitioner beta — cost visibility + kill switch (petitionhq/beta_onboarding_plan.md)
  const betaUsers = await prisma.user.findMany({
    where: { selfPetitionerBeta: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, betaAgreementAcceptedAt: true,
      ownedCases: { select: { id: true, title: true }, take: 1 },
    },
  });
  const betaCaseIds = betaUsers.map((u) => u.ownedCases[0]?.id).filter((x): x is string => !!x);
  const betaCostAgg = betaCaseIds.length > 0
    ? await prisma.llmUsage.groupBy({ by: ["caseId"], _sum: { cents: true }, where: { caseId: { in: betaCaseIds } } })
    : [];
  const betaCostByCase = new Map(betaCostAgg.map((r) => [r.caseId!, r._sum.cents ?? 0]));
  const betaTotalCostCents = betaCostAgg.reduce((sum, r) => sum + (r._sum.cents ?? 0), 0);

  // Time inquiry→retainer (for signed outcomes: deliveredAt→updatedAt in days)
  const signedOutcomes = allOutcomes.filter((o) => o.status === "signed" && o.revenueCents);
  const avgDaysToSign = signedOutcomes.length > 0
    ? Math.round(signedOutcomes.reduce((sum, o) => sum + (o.updatedAt.getTime() - o.deliveredAt.getTime()) / 86_400_000, 0) / signedOutcomes.length)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Pilot Dashboard</h1>
        <p className="text-sm text-text-muted mt-1">Concierge delivery of consented leads to the first pilot firm.</p>
      </div>

      {/* Scorecard */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total leads" value={totalLeads} />
        <Stat label="Consented" value={`${leads.length}`} sub={`${consentRate}% of leads`} />
        <Stat label="ORCID OAuth" value={`${orcidLeads}`} sub={`${orcidRate}% of leads`} />
        <Stat label="Delivered" value={totalDelivered} />
        <Stat label="Consult booked" value={consultBooked} />
        <Stat
          label="Consult rate"
          value={totalDelivered > 0 ? `${consultRate}%` : "—"}
          tone={totalDelivered > 0 && consultRate >= 30 ? "success" : "default"}
        />
        <Stat
          label="Junk rate"
          value={totalDelivered > 0 ? `${junkRate}%` : "—"}
          tone={totalDelivered > 0 && junkRate > 30 ? "warning" : "default"}
        />
        <Stat
          label="Signed revenue"
          value={totalRevenueCents > 0 ? `$${(totalRevenueCents / 100).toFixed(0)}` : "—"}
          tone={totalRevenueCents > 0 ? "accent" : "default"}
        />
        {avgDaysToSign !== null && <Stat label="Avg. days to sign" value={`${avgDaysToSign}d`} />}
      </div>

      {/* Lead queue */}
      <div>
        <h2 className="font-serif text-lg mb-3">Consented leads ({leads.length})</h2>
        {leads.length === 0 ? (
          <p className="text-sm text-text-muted">No consented leads yet.</p>
        ) : (
          <div className="space-y-2">
            {leads.map((lead) => {
              const fd = lead.formData as Record<string, unknown> | null;
              const vc = lead.verifiedClaims as Record<string, { status: string; detail?: string }> | null;
              const level = (vc?.["_verificationLevel"]?.detail ?? null) as VerificationLevel | null;
              const flags = deriveCommercialFlags(fd);
              const outcome = lead.outcomes[0] ?? null;
              const tierMeta = TIER_META[legacyTierToCanonical(lead.tier ?? "tier3")];
              const flagDots: Record<string, string> = { green: "bg-success-text", yellow: "bg-warning-text", grey: "bg-border-default" };

              return (
                <div key={lead.id} className="rounded-xl border border-border-default bg-surface-card px-4 py-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    {/* Lead info */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`badge badge-${tierMeta.statusToken} shrink-0`}>
                          {lead.tier ?? "—"}
                        </span>
                        {lead.trustScore > 0 && (
                          <span className={`text-xs font-bold tabular-nums ${
                            lead.trustScore >= 60 ? "text-success-text" : lead.trustScore >= 40 ? "text-warning-text" : "text-danger-text"
                          }`}>
                            Trust {lead.trustScore}/100
                          </span>
                        )}
                        {lead.score != null && (
                          <span className="text-xs text-text-muted">Score {lead.score}/100</span>
                        )}
                        {level && (
                          <span className="text-xs text-info-text">{LEVEL_LABEL[level]}</span>
                        )}
                        {/* Commercial dots */}
                        <span className="flex items-center gap-1" title="US Plan · Self-petition · National hook">
                          {[flags.usPlan, flags.selfPetitionFit, flags.nationalHook].map((f) => (
                            <span key={f.label} title={`${f.label}: ${f.value}`}
                              className={`h-2 w-2 rounded-full ${flagDots[f.color]}`}
                            />
                          ))}
                        </span>
                      </div>
                      <div className="text-xs text-text-muted">
                        {lead.name || `Lead #${lead.id.slice(0, 8)}`}
                        {" · "}
                        {fd ? String(fd.field ?? "Research") : "Research"}
                        {" · "}
                        {new Date(lead.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </div>
                      {outcome && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`badge ${STATUS_COLOR[outcome.status] ?? "badge-neutral"}`}>
                            {STATUS_LABEL[outcome.status] ?? outcome.status}
                          </span>
                          <span className="text-xs text-text-muted">{outcome.pilotFirm}</span>
                          {outcome.reason && <span className="text-xs text-text-muted italic">{outcome.reason}</span>}
                          {outcome.revenueCents ? <span className="text-xs text-success-text font-semibold">${(outcome.revenueCents / 100).toFixed(0)}</span> : null}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 items-end shrink-0">
                      <Link href={`/leads/${lead.id}`} className="btn btn-secondary text-xs py-1">
                        View →
                      </Link>
                      <DeliverButton leadId={lead.id} alreadyDelivered={!!outcome} />
                      {outcome && (
                        <OutcomeSelect
                          leadId={lead.id}
                          outcomeId={outcome.id}
                          current={outcome.status as "delivered" | "consult_booked" | "signed" | "rejected_junk"}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Self-petitioner beta — cost visibility + kill switch */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-lg">Self-petitioner beta ({betaUsers.length})</h2>
          {betaTotalCostCents > 0 && (
            <span className="text-sm text-text-muted">
              ${(betaTotalCostCents / 100).toFixed(2)} total LLM cost across all beta users
            </span>
          )}
        </div>
        {betaUsers.length === 0 ? (
          <p className="text-sm text-text-muted">No self-petitioner beta users yet.</p>
        ) : (
          <div className="space-y-2">
            {betaUsers.map((u) => {
              const c = u.ownedCases[0];
              const costCents = c ? betaCostByCase.get(c.id) ?? 0 : 0;
              const pct = Math.min(100, Math.round((costCents / BETA_CASE_COST_CAP_CENTS) * 100));
              const barColor = pct >= 100 ? "bg-danger-fill" : pct >= 75 ? "bg-warning-fill" : "bg-success-fill";
              return (
                <div key={u.id} className="rounded-xl border border-border-default bg-surface-card px-4 py-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/admin/users/${u.id}`} className="font-medium text-text-primary hover:underline">
                          {u.name}
                        </Link>
                        <span className="text-xs text-text-muted">{u.email}</span>
                      </div>
                      <div className="text-xs text-text-muted">
                        Agreement {u.betaAgreementAcceptedAt ? new Date(u.betaAgreementAcceptedAt).toLocaleDateString() : "not accepted"}
                        {c && (
                          <>
                            {" · "}
                            <Link href={`/cases/${c.id}`} className="hover:underline">{c.title}</Link>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-muted">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-text-muted">
                          ${(costCents / 100).toFixed(2)} / ${(BETA_CASE_COST_CAP_CENTS / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      <BetaDeactivateButton userId={u.id} className="btn btn-secondary text-xs py-1" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
