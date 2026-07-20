import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listCases } from "@/lib/db";
import { listUsers } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { Stat } from "@/components/Stat";
import { StatHero } from "@/components/StatHero";
import { StuckLeads } from "./StuckLeads";
import { Users, Folder, CheckCircle, ArrowUpRight, AlertTriangle } from "@/components/icons";
import { FUNNEL_LABELS } from "@/lib/funnel";
import { plural } from "@/lib/pluralize";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  draft:  "badge badge-neutral",
  review: "badge badge-info",
  ready:  "badge badge-success",
  filed:  "badge badge-neutral",
};

export default async function AdminDashboard() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);

  const [cases, users, letterCount, leadStats, claims, intakeCompleted, claimedLeads, uniqueResultViews, uniqueConsents, pendingRefunds, funnelEvents, stuckLeads, allLeadDates, priorViews, priorConsents, awaitingMatchCount] = await Promise.all([
    listCases({ role: "admin" }),
    listUsers(),
    prisma.letter.count(),
    prisma.lead.groupBy({ by: ["tier"], _count: { id: true } }),
    prisma.activityLog.count({ where: { action: "lead.claimed",       createdAt: { gte: thirtyDaysAgo } } }),
    prisma.activityLog.count({ where: { action: "intake.completed",   createdAt: { gte: thirtyDaysAgo } } }),
    prisma.lead.findMany({
      where: { claimedAt: { not: null } },
      select: { capturedAt: true, claimedAt: true },
    }),
    // Unique leads with result pages viewed (capturedAt in last 30 days = accessed within window)
    prisma.lead.count({ where: { capturedAt: { gte: thirtyDaysAgo } } }),
    // Unique leads that consented (applicantStatus = "approved")
    prisma.lead.count({ where: { applicantStatus: "approved", capturedAt: { gte: thirtyDaysAgo } } }),
    prisma.refundRequest.count({ where: { status: "pending" } }),
    // Key funnel steps for inline conversion table
    prisma.funnelEvent.groupBy({
      by: ["event"],
      _count: { id: true },
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    // Stuck leads: M3 with trustScore < 60 — need re-verification after R0-2 fix
    prisma.lead.findMany({
      where: { maturity: "M3", trustScore: { lt: 60 } },
      select: { id: true, name: true, trustScore: true, capturedAt: true, formData: true },
      orderBy: { capturedAt: "asc" },
      take: 10,
    }),
    // Lightweight series for the hero sparkline + period-over-period delta.
    prisma.lead.findMany({ select: { capturedAt: true } }),
    prisma.lead.count({ where: { capturedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.lead.count({ where: { applicantStatus: "approved", capturedAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    // Consented, unclaimed, and not yet delivered — the actionable match queue.
    prisma.lead.count({ where: { applicantStatus: "approved", claimedByUserId: null, caseId: null, outcomes: { none: {} } } }),
  ]);

  const consentRate    = uniqueResultViews > 0 ? Math.round((uniqueConsents / uniqueResultViews) * 100) : null;
  const intakeRate     = claims > 0 ? Math.round((intakeCompleted / claims) * 100) : null;
  const avgClaimHours  = claimedLeads.length > 0
    ? Math.round(claimedLeads.reduce((sum, l) => sum + (l.claimedAt!.getTime() - l.capturedAt.getTime()), 0) / claimedLeads.length / 3_600_000)
    : null;

  const totalLeads = leadStats.reduce((sum, g) => sum + g._count.id, 0);
  const tier1Leads = leadStats.find((g) => g.tier === "tier1")?._count.id ?? 0;
  const tier2Leads = leadStats.find((g) => g.tier === "tier2")?._count.id ?? 0;
  const tier3Leads = leadStats.find((g) => g.tier === "tier3")?._count.id ?? 0;

  // Period-over-period: consent rate (pts) and lead volume.
  const priorConsentRate = priorViews > 0 ? Math.round((priorConsents / priorViews) * 100) : null;
  const consentDelta = consentRate !== null && priorConsentRate !== null ? consentRate - priorConsentRate : null;

  const leadsLast30  = allLeadDates.filter((l) => l.capturedAt >= thirtyDaysAgo).length;
  const leadsPrior30 = allLeadDates.filter((l) => l.capturedAt >= sixtyDaysAgo && l.capturedAt < thirtyDaysAgo).length;
  const leadsDelta   = leadsLast30 - leadsPrior30;

  // 8-week lead-volume sparkline (most recent week last).
  const WEEKS = 8;
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const leadSpark = Array<number>(WEEKS).fill(0);
  for (const { capturedAt } of allLeadDates) {
    const ageWeeks = Math.floor((now - capturedAt.getTime()) / weekMs);
    if (ageWeeks >= 0 && ageWeeks < WEEKS) leadSpark[WEEKS - 1 - ageWeeks] += 1;
  }

  const attorneys  = users.filter((u) => u.role === "attorney");
  const admins     = users.filter((u) => u.role === "admin");
  const applicants = users.filter((u) => u.role === "applicant");

  const funnelCounts: Record<string, number> = {};
  for (const r of funnelEvents) funnelCounts[r.event] = r._count.id;

  // Key conversion steps for the inline funnel (linear path only)
  const KEY_STEPS = [
    "check.started",
    "lead.email_submitted",
    "lead.consent_given",
    "lead.claimed",
  ] as const;

  const byStatus = cases.reduce<Record<string, number>>((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  const pendingReviews  = cases.filter((c) => c.reviewStatus === "pending").length;
  const unassignedCases = cases.filter((c) => !c.attorneyId).length;

  // Recent 8 cases sorted by updatedAt
  const recentCases = [...cases]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Admin dashboard</h1>
        <p className="mt-1 text-sm text-text-secondary">Platform overview and quick actions</p>
      </div>

      {/* Action queue: consented leads with no attorney yet — the "who's ready
          to be matched" surface. Only shown when there's something to act on. */}
      {awaitingMatchCount > 0 && (
        <Link
          href="/admin/leads?consent=awaiting"
          className="group flex items-center justify-between gap-4 rounded-xl border border-info-border bg-info-bg px-5 py-4 transition-colors hover:border-info-text/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-soft text-info-text">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-info-text">
                {awaitingMatchCount} consented {awaitingMatchCount === 1 ? "lead is" : "leads are"} awaiting an attorney
              </p>
              <p className="text-xs text-info-text/80">
                They consented to be matched — no firm has claimed them yet. Review the queue and hand them to an attorney.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-medium text-info-text group-hover:underline">Review queue →</span>
        </Link>
      )}

      {/* Hero metric + supporting stats */}
      <div className="space-y-4">
        <StatHero
          label="Active leads"
          value={totalLeads}
          icon={<Users className="h-6 w-6" />}
          delta={
            leadsDelta === 0
              ? { value: "no change", direction: "flat" }
              : { value: `${leadsDelta > 0 ? "+" : ""}${leadsDelta}`, direction: leadsDelta > 0 ? "up" : "down", label: "vs prior 30d" }
          }
          sub={`${tier1Leads} strong · ${tier2Leads} developing · ${tier3Leads} early`}
          spark={leadSpark}
          href="/admin/leads"
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Total cases" value={cases.length} icon={<Folder className="h-4 w-4" />} href="/cases" />
          <Stat label="Total users" value={users.length}
            icon={<Users className="h-4 w-4" />}
            sub={`${plural(attorneys.length, "attorney")} · ${plural(admins.length, "admin")} · ${plural(applicants.length, "applicant")}`}
            href="/admin/users" />
          <Stat label="Letters drafted" value={letterCount} icon={<CheckCircle className="h-4 w-4" />} />
        </div>
      </div>

      {/* Operational KPIs — 30-day rolling */}
      <div>
        <h2 className="font-serif text-xl tracking-tight mb-4">Operational KPIs <span className="text-sm font-sans font-normal text-text-muted">(last 30 days)</span></h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat
            label="Consent rate"
            value={consentRate !== null ? `${consentRate}%` : "—"}
            icon={<CheckCircle className="h-4 w-4" />}
            delta={
              consentDelta !== null && consentDelta !== 0
                ? { value: `${Math.abs(consentDelta)} pts`, direction: consentDelta > 0 ? "up" : "down" }
                : undefined
            }
            sub={`${uniqueConsents} consents / ${uniqueResultViews} leads`}
            tone={consentRate !== null && consentRate < 15 ? "warning" : "default"}
          />
          <Stat
            label="Avg claim velocity"
            value={avgClaimHours !== null ? `${avgClaimHours}h` : "—"}
            icon={<ArrowUpRight className="h-4 w-4" />}
            sub={`${claimedLeads.length} leads claimed all-time`}
          />
          <Stat
            label="Intake completion"
            value={intakeRate !== null ? `${intakeRate}%` : "—"}
            icon={<AlertTriangle className="h-4 w-4" />}
            sub={`${intakeCompleted} completed / ${claims} cases created`}
            tone={intakeRate !== null && intakeRate < 50 ? "warning" : "default"}
          />
        </div>
      </div>

      {/* Alert strip */}
      {pendingReviews > 0 && (
        <div className="alert alert-warning flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-warning-text" />
          <span className="text-sm font-medium text-warning-text">
            {pendingReviews} review request{pendingReviews !== 1 ? "s" : ""} pending attorney response
          </span>
          <Link href="/admin/cases" className="ml-auto text-xs text-warning-text hover:underline">
            View →
          </Link>
        </div>
      )}

      {pendingRefunds > 0 && (
        <div className="alert alert-warning flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-warning-text" />
          <span className="text-sm font-medium text-warning-text">
            {pendingRefunds} refund request{pendingRefunds !== 1 ? "s" : ""} awaiting review
          </span>
          <Link href="/admin/refunds" className="ml-auto text-xs text-warning-text hover:underline">
            Review →
          </Link>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Cases by status */}
        <div className="card space-y-4">
          <h2 className="font-serif text-xl tracking-tight">Cases by status</h2>
          {Object.keys(byStatus).length === 0 ? (
            <div className="empty-state"><p className="empty-state-title">No cases yet</p></div>
          ) : (
            <div className="space-y-2">
              {["draft", "review", "ready", "filed"].map((s) => {
                const count = byStatus[s] ?? 0;
                const pct = cases.length ? Math.round((count / cases.length) * 100) : 0;
                return (
                  <div key={s} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="capitalize text-text-secondary">{s}</span>
                      <span className="font-medium text-text-primary">{count}</span>
                    </div>
                    <div className="progress">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/cases" className="inline-block text-xs text-text-muted hover:text-text-primary">
            Manage all cases →
          </Link>
        </div>

        {/* Attorney workload */}
        <div className="card space-y-4">
          <h2 className="font-serif text-xl tracking-tight">Attorney workload</h2>
          {attorneys.length === 0 ? (
            <div className="empty-state"><p className="empty-state-title">No attorneys yet</p></div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {attorneys.map((a) => {
                const assigned = cases.filter((c) => c.attorneyId === a.id);
                const pending  = assigned.filter((c) => c.reviewStatus === "pending").length;
                const unread   = assigned.reduce(
                  (sum, c) => sum + (c.messages ?? []).filter((m) => !m.read && m.senderId !== a.id).length,
                  0
                );
                return (
                  <div key={a.id} className="flex items-center justify-between gap-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-text-primary">{a.name}</div>
                      <div className="text-xs text-text-muted">{assigned.length} case{assigned.length !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {pending > 0 && (
                        <span className="badge badge-warning">
                          {pending} review{pending !== 1 ? "s" : ""}
                        </span>
                      )}
                      {unread > 0 && (
                        <span className="badge badge-inverted">
                          {unread} unread
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <Link href="/admin/cases" className="inline-block text-xs text-text-muted hover:text-text-primary">
            View all clients →
          </Link>
        </div>
      </div>

      {/* Recent cases */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-tight">Recent activity</h2>
          <Link href="/cases" className="text-xs text-text-muted hover:text-text-primary">All cases →</Link>
        </div>
        {recentCases.length === 0 ? (
          <div className="empty-state"><p className="empty-state-title">No cases yet</p></div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {recentCases.map((c) => (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="flex items-center gap-4 py-3 hover:opacity-70 transition-opacity"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-text-primary">{c.title}</span>
                    <span className={`shrink-0 ${STATUS_BADGE[c.status] ?? "badge badge-neutral"}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-0.5">
                    Updated {new Date(c.updatedAt).toLocaleDateString()}
                    {!c.attorneyId && (
                      <span className="ml-2 text-warning-text">· no attorney</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Inline funnel — key conversion steps */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl tracking-tight">
            Funnel <span className="text-sm font-sans font-normal text-text-muted">(last 30 days)</span>
          </h2>
          <Link href="/admin/funnel" className="text-xs text-text-muted hover:text-text-primary">Full funnel →</Link>
        </div>
        <div className="space-y-3">
          {KEY_STEPS.map((step, i) => {
            const count = funnelCounts[step] ?? 0;
            const prev = i > 0 ? (funnelCounts[KEY_STEPS[i - 1]] ?? 0) : 0;
            const convRate = i > 0 && prev > 0 ? Math.round((count / prev) * 100) : null;
            const top = funnelCounts[KEY_STEPS[0]] ?? 1;
            const barPct = top > 0 ? Math.round((count / top) * 100) : 0;
            return (
              <div key={step} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">{FUNNEL_LABELS[step] ?? step}</span>
                  <span className="font-medium tabular-nums text-text-primary">{count.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="progress flex-1">
                    <div className="progress-fill" style={{ width: `${barPct}%` }} />
                  </div>
                  {convRate !== null && (
                    <span className={`w-12 text-right text-xs tabular-nums ${convRate < 20 ? "text-warning-text" : "text-text-muted"}`}>
                      {convRate}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stuck leads — M3 with trust < 60 (need re-verification after R0-2 fix) */}
      {stuckLeads.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl tracking-tight">Stuck leads</h2>
              <p className="text-xs text-text-muted mt-0.5">M3 + trust &lt; 60 — won&apos;t reach marketplace without re-verification</p>
            </div>
            <Link href="/admin/leads?maturity=M3" className="text-xs text-text-muted hover:text-text-primary">View all →</Link>
          </div>
          <StuckLeads
            leads={stuckLeads.map((lead) => {
              const fd = lead.formData as Record<string, unknown> | null;
              return {
                id: lead.id,
                name: lead.name,
                field: fd ? String(fd.field ?? "Research") : "Research",
                trustScore: lead.trustScore ?? 0,
                capturedAt: lead.capturedAt.toISOString(),
              };
            })}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="card space-y-3">
        <h2 className="font-serif text-xl tracking-tight">Quick actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/cases/new" className="btn btn-primary">New case</Link>
          <Link href="/admin/firms" className="btn btn-secondary">Manage firms</Link>
          <Link href="/admin/users" className="btn btn-secondary">Manage users</Link>
          <Link href="/admin/funnel" className="btn btn-secondary">Funnel analytics</Link>
          <Link href="/forms" className="btn btn-secondary">Forms catalogue</Link>
        </div>
      </div>
    </div>
  );
}

