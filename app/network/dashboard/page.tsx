import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Stat } from "@/components/Stat";
import { StatHero } from "@/components/StatHero";
import { Folder, CheckCircle, ArrowUpRight, Shield } from "@/components/icons";
import { TIER_META, legacyTierToCanonical } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const AVG_ATTORNEY_HOURS_PER_DRAFT = 3.5;

export default async function NetworkDashboardPage() {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    redirect("/login");
  }

  const firm = await prisma.firmProfile.findUnique({ where: { userId: session.userId } });

  const claimedLeads = await prisma.lead.findMany({
    where: { claimedByUserId: session.userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, tier: true, score: true, status: true, dossierStatus: true, caseId: true, formData: true, capturedAt: true },
  });

  const caseIds = claimedLeads.map((l) => l.caseId).filter((id): id is string => !!id);
  const casesWithFollowUp = caseIds.length > 0
    ? await prisma.case.findMany({
        where: { id: { in: caseIds } },
        select: { id: true, status: true, nextFollowUp: true, nextAction: true },
      })
    : [];
  const caseMap = new Map(casesWithFollowUp.map((c) => [c.id, c]));
  const overdueCount = casesWithFollowUp.filter(
    (c) => c.nextFollowUp && c.nextFollowUp < new Date(),
  ).length;

  const draftsGenerated = claimedLeads.filter((l) => l.dossierStatus === "completed").length;
  const hoursSaved = Math.round(draftsGenerated * AVG_ATTORNEY_HOURS_PER_DRAFT);
  const avgScore = claimedLeads.length > 0
    ? Math.round(claimedLeads.reduce((sum, l) => sum + (l.score ?? 0), 0) / claimedLeads.length)
    : null;

  const statusCounts = claimedLeads.reduce<Record<string, number>>((acc, l) => {
    acc[l.status] = (acc[l.status] ?? 0) + 1;
    return acc;
  }, {});

  const completionRate = claimedLeads.length > 0
    ? `${Math.round((draftsGenerated / claimedLeads.length) * 100)}%`
    : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">
            {firm?.firmName ?? "My dashboard"}
          </h1>
          <p className="mt-0.5 text-sm text-text-secondary">Attorney network overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/network/rules" className="btn btn-secondary text-sm">
            Drafting rules
          </Link>
          <Link href="/network/leads" className="btn btn-primary text-sm">
            Browse available cases →
          </Link>
        </div>
      </div>

      {/* Overdue follow-ups alert */}
      {overdueCount > 0 && (
        <div className="alert alert-warning">
          <p>
            <strong>{overdueCount} case{overdueCount > 1 ? "s" : ""}</strong> with overdue follow-ups.
            {" "}Review your upcoming tasks below.
          </p>
        </div>
      )}

      {/* Hero metric + supporting stats */}
      <div className="space-y-4">
        <StatHero
          label="Cases claimed"
          value={claimedLeads.length}
          icon={<Folder className="h-6 w-6" />}
          sub={draftsGenerated > 0 ? `${draftsGenerated} with drafts generated` : "Claim a lead to get started"}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Drafts generated" value={draftsGenerated} icon={<CheckCircle className="h-4 w-4" />} />
          <Stat
            label="Hours saved"
            value={hoursSaved > 0 ? `${hoursSaved}h` : "—"}
            icon={<ArrowUpRight className="h-4 w-4" />}
            tone={hoursSaved > 0 ? "accent" : "default"}
            sub={`~${AVG_ATTORNEY_HOURS_PER_DRAFT}h saved per draft`}
          />
          <Stat label="Avg case score" value={avgScore ?? "—"} icon={<Shield className="h-4 w-4" />} />
        </div>
      </div>

      {/* Performance metrics — only shown once cases exist */}
      {claimedLeads.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Pipeline</p>
            <div className="flex items-baseline gap-3">
              {Object.entries(statusCounts).map(([st, n]) => (
                <div key={st}>
                  <span className="text-2xl font-bold text-text-primary">{n}</span>
                  <span className="ml-1 text-xs text-text-muted capitalize">{st}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Completion rate</p>
            <p className="text-3xl font-bold text-text-primary">{completionRate ?? "—"}</p>
          </div>
        </div>
      )}

      {/* My cases table */}
      {claimedLeads.length > 0 ? (
        <div className="table-shell">
          <div className="table-shell-header">My cases</div>
          <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header-cell">Field</th>
                <th className="table-header-cell">Tier</th>
                <th className="table-header-cell">Score</th>
                <th className="table-header-cell">Status</th>
                <th className="table-header-cell">Next follow-up</th>
                <th className="table-header-cell" />
              </tr>
            </thead>
            <tbody>
              {claimedLeads.map((l) => {
                const fd = l.formData as Record<string, unknown> | null;
                const field = fd ? String(fd.field ?? "Research") : "Research";
                const caseInfo = l.caseId ? caseMap.get(l.caseId) : null;
                const fuDate = caseInfo?.nextFollowUp;
                const fuOverdue = fuDate && fuDate < new Date();
                const fuSoon = fuDate && !fuOverdue && fuDate.getTime() <= Date.now() + 2 * 86400000;
                const tierMeta = TIER_META[legacyTierToCanonical(l.tier ?? "tier3")];
                return (
                  <tr key={l.id} className="table-row">
                    <td className="table-cell font-medium">{field}</td>
                    <td className="table-cell">
                      <span className={`badge badge-${tierMeta.statusToken}`}>{tierMeta.label}</span>
                    </td>
                    <td className="table-cell tabular-nums text-text-secondary">{l.score ?? "—"}</td>
                    <td className="table-cell capitalize text-text-secondary text-xs">
                      {caseInfo?.status ?? l.status}
                    </td>
                    <td className="table-cell text-xs">
                      {fuDate ? (
                        <span className={
                          fuOverdue ? "font-semibold text-danger-fill" :
                          fuSoon ? "font-semibold text-warning-text" :
                          "text-text-muted"
                        }>
                          {fuDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {caseInfo?.nextAction && (
                            <span className="ml-1 text-text-muted font-normal">
                              — {caseInfo.nextAction.length > 30 ? caseInfo.nextAction.slice(0, 30) + "…" : caseInfo.nextAction}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      {l.caseId && (
                        <Link href={`/cases/${l.caseId}`} className="text-text-muted underline hover:text-text-primary text-xs">
                          Open →
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <p className="empty-state-title text-base">How PetitionHQ works</p>
          <p className="empty-state-body">
            You have no claimed cases yet. Here&apos;s the full loop — start to filed.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3 w-full max-w-2xl text-left">
            {([
              { n: "1", title: "Browse attorney-ready leads", body: "Every lead is pre-scored and corroborated against public research records before you see it." },
              { n: "2", title: "Claim for $150", body: "Auto-refunded in 14 days if the applicant doesn't complete intake. No referral fees." },
              { n: "3", title: "Workspace + AI drafts", body: "Full dossier, exhibit plan, and AI-drafted brief sections unlock the moment you claim." },
            ] as const).map(({ n, title, body }) => (
              <div key={n} className="card flex flex-col gap-2 text-left">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-text-inverted text-xs font-bold shrink-0">{n}</span>
                <p className="text-sm font-semibold text-text-primary">{title}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
          <div className="card-feature mt-4 w-full max-w-2xl flex items-center justify-between gap-4">
            <p className="text-sm text-text-inverted opacity-80">Ready to find your first case?</p>
            <Link href="/network/leads" className="btn btn-inverted text-sm shrink-0">
              Browse available leads →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
