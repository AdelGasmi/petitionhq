import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FUNNEL_STEPS, FUNNEL_LABELS } from "@/lib/funnel";

export const dynamic = "force-dynamic";

const VALID_DAYS = [7, 30, 90] as const;
type Days = (typeof VALID_DAYS)[number];

type Props = {
  searchParams: Promise<{ days?: string }>;
};

export default async function FunnelPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  const sp = await searchParams;
  const days = (VALID_DAYS.find((d) => String(d) === sp.days) ?? 30) as Days;

  const msPerDay = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const since = new Date(now - days * msPerDay);
  const priorSince = new Date(now - 2 * days * msPerDay);

  const [currentRows, priorRows, recentEvents, bouncedEvents] = await Promise.all([
    prisma.funnelEvent.groupBy({
      by: ["event"],
      _count: { id: true },
      where: { createdAt: { gte: since } },
    }),
    prisma.funnelEvent.groupBy({
      by: ["event"],
      _count: { id: true },
      where: { createdAt: { gte: priorSince, lt: since } },
    }),
    prisma.funnelEvent.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.funnelEvent.findMany({
      where: { event: "check.bounced", createdAt: { gte: since } },
      select: { props: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of currentRows) counts[r.event] = r._count.id;
  const prior: Record<string, number> = {};
  for (const r of priorRows) prior[r.event] = r._count.id;

  const bouncePhaseCounts: Record<string, number> = {};
  for (const e of bouncedEvents) {
    const phase = (e.props as Record<string, unknown> | null)?.phase;
    if (typeof phase === "string") {
      bouncePhaseCounts[phase] = (bouncePhaseCounts[phase] ?? 0) + 1;
    }
  }

  const SIDE_CHANNEL_EVENTS = new Set([
    "check.bounced",
    "lead.applicant_rejected",
    "verification.preliminary_completed",
    "verification.teaser_clicked",
    "verification.deep_started",
    "verification.deep_completed",
    "verification.contradiction_flagged",
  ]);
  const funnelSteps = FUNNEL_STEPS.filter((s) => !SIDE_CHANNEL_EVENTS.has(s));
  const totalEvents = currentRows.reduce((sum, r) => sum + r._count.id, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Funnel</h1>
          <p className="mt-1 text-sm text-text-muted">
            Last {days} days · {totalEvents} total events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-border-default text-sm">
            {VALID_DAYS.map((d) => (
              <Link
                key={d}
                href={`/admin/funnel?days=${d}`}
                className={`border-r border-border-default px-3 py-1.5 last:border-r-0 transition-colors ${
                  days === d ? "bg-surface-inverted text-text-inverted" : "hover:bg-surface-muted"
                }`}
              >
                {d}d
              </Link>
            ))}
          </div>
          <Link href="/admin" className="btn btn-secondary">Dashboard</Link>
        </div>
      </div>

      {/* Main funnel table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wider text-text-muted">
              <th className="px-5 py-3">Step</th>
              <th className="px-5 py-3 text-right">Count</th>
              <th className="px-5 py-3 text-right">vs prior {days}d</th>
              <th className="px-5 py-3 text-right">Step conv.</th>
              <th className="px-5 py-3">Bar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {funnelSteps.map((step, i) => {
              const count = counts[step] ?? 0;
              const priorCount = prior[step] ?? 0;
              const delta = count - priorCount;
              const prevCount = i === 0 ? count : (counts[funnelSteps[i - 1]] ?? 0);
              const rate = prevCount > 0 ? (count / prevCount) * 100 : 0;
              const topCount = counts[funnelSteps[0]] ?? 1;
              const barWidth = topCount > 0 ? (count / topCount) * 100 : 0;

              return (
                <tr key={step} className="hover:bg-surface-subtle">
                  <td className="px-5 py-3">
                    <span className="font-medium text-text-primary">
                      {FUNNEL_LABELS[step] ?? step}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-text-secondary">
                    {count}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-xs">
                    {priorCount === 0 && count === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <span
                        className={
                          delta > 0
                            ? "text-success-text"
                            : delta < 0
                            ? "text-danger-text"
                            : "text-text-muted"
                        }
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {i === 0 ? (
                      <span className="text-text-muted">—</span>
                    ) : (
                      <span
                        className={`font-medium ${
                          rate >= 50
                            ? "text-success-text"
                            : rate >= 20
                            ? "text-warning-text"
                            : "text-danger-text"
                        }`}
                      >
                        {rate.toFixed(1)}%
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ width: "40%" }}>
                    <div className="h-3 w-full rounded-full bg-surface-muted">
                      <div
                        className="h-3 rounded-full bg-brand-primary transition-all"
                        style={{ width: `${Math.max(barWidth, count > 0 ? 2 : 0)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Verification pipeline sub-section */}
        {((counts["verification.preliminary_completed"] ?? 0) > 0 ||
          (counts["verification.deep_completed"] ?? 0) > 0) && (
          <div className="border-t border-border-default bg-info-bg px-5 py-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-info-text">
              Verification pipeline
            </h4>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {(
                [
                  ["verification.preliminary_completed", "Preliminary pings"],
                  ["verification.teaser_clicked", "Teaser clicks"],
                  ["verification.deep_started", "Deep verifications started"],
                  ["verification.deep_completed", "Deep verifications completed"],
                  ["verification.contradiction_flagged", "Contradictions flagged"],
                ] as const
              ).map(([key, label]) => {
                const c = counts[key] ?? 0;
                const p = prior[key] ?? 0;
                const d = c - p;
                if (c === 0) return null;
                return (
                  <div key={key} className="flex items-center justify-between gap-4">
                    <span
                      className={
                        key === "verification.contradiction_flagged"
                          ? "text-danger-text"
                          : "text-info-text"
                      }
                    >
                      {label}
                    </span>
                    <span className="flex items-center gap-2 font-mono font-medium text-info-text">
                      {c}
                      {(c > 0 || p > 0) && (
                        <span
                          className={`text-xs ${
                            d > 0
                              ? "text-success-text"
                              : d < 0
                              ? "text-danger-text"
                              : "text-text-muted"
                          }`}
                        >
                          {d > 0 ? "+" : ""}
                          {d}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bounce side-channel */}
        {(counts["check.bounced"] ?? 0) > 0 && (
          <div className="space-y-2 border-t border-border-default bg-warning-bg px-5 py-3 text-sm">
            <div className="flex items-center gap-3">
              <span className="font-medium text-warning-text">
                Check bounced: {counts["check.bounced"]}
              </span>
              {(() => {
                const d = (counts["check.bounced"] ?? 0) - (prior["check.bounced"] ?? 0);
                const hasPrior = (prior["check.bounced"] ?? 0) > 0 || (counts["check.bounced"] ?? 0) > 0;
                if (!hasPrior) return null;
                return (
                  <span
                    className={`text-xs font-mono ${
                      d > 0
                        ? "text-danger-text"
                        : d < 0
                        ? "text-success-text"
                        : "text-text-muted"
                    }`}
                  >
                    {d > 0 ? "+" : ""}
                    {d} vs prior {days}d
                  </span>
                );
              })()}
            </div>
            {Object.keys(bouncePhaseCounts).length > 0 && (
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-warning-text">
                {Object.entries(bouncePhaseCounts)
                  .sort(([, a], [, b]) => b - a)
                  .map(([phase, c]) => (
                    <div key={phase} className="flex justify-between">
                      <span className="text-warning-text/80">at: {phase}</span>
                      <span className="font-mono font-medium">{c}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Rejection side-channel */}
        {(counts["lead.applicant_rejected"] ?? 0) > 0 && (
          <div className="border-t border-border-default bg-danger-bg px-5 py-3 text-sm">
            <span className="font-medium text-danger-text">
              Applicant rejected: {counts["lead.applicant_rejected"]}
            </span>
            {(() => {
              const d =
                (counts["lead.applicant_rejected"] ?? 0) -
                (prior["lead.applicant_rejected"] ?? 0);
              const hasPrior =
                (prior["lead.applicant_rejected"] ?? 0) > 0 ||
                (counts["lead.applicant_rejected"] ?? 0) > 0;
              if (!hasPrior) return null;
              return (
                <span
                  className={`ml-2 text-xs font-mono ${
                    d > 0
                      ? "text-danger-text"
                      : d < 0
                      ? "text-success-text"
                      : "text-text-muted"
                  }`}
                >
                  {d > 0 ? "+" : ""}
                  {d} vs prior {days}d
                </span>
              );
            })()}
          </div>
        )}
      </div>

      {/* Recent events timeline */}
      <div>
        <h2 className="mb-3 font-serif text-xl tracking-tight">Recent events</h2>
        {recentEvents.length === 0 ? (
          <div className="card text-sm text-text-muted">
            No funnel events recorded yet. Events will appear here as users go through the
            check → lead → claim pipeline.
          </div>
        ) : (
          <div className="card divide-y divide-border-subtle overflow-hidden p-0">
            {recentEvents.map((e) => {
              const dotColor =
                e.event === "verification.contradiction_flagged"
                  ? "bg-danger-fill"
                  : e.event.startsWith("verification.")
                  ? "bg-info-fill"
                  : "bg-text-muted";
              return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-2.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${dotColor}`} />
                  <span className="text-sm font-medium text-text-secondary">
                    {FUNNEL_LABELS[e.event] ?? e.event}
                  </span>
                  {e.leadId && (
                    <Link
                      href={`/leads/${e.leadId}`}
                      className="text-xs text-text-muted hover:underline"
                    >
                      {e.leadId.slice(0, 8)}…
                    </Link>
                  )}
                  {e.props && typeof e.props === "object" && (
                    <span className="text-xs text-text-muted">
                      {Object.entries(e.props as Record<string, unknown>)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-text-muted">
                    {timeAgo(e.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function timeAgo(d: Date) {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
