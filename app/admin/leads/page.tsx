import { redirect } from "next/navigation";
import Link from "next/link";
import { type Prisma, LeadMaturity } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIER_META, TIER_THRESHOLDS } from "@/lib/scoring";
import { buildSnippet } from "./snippet";
import { LeadsTable, type LeadRow, type SortKey } from "./LeadsTable";
import { Users } from "@/components/icons";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  tier1: `Tier 1 — ${TIER_META.strong.longLabel} (≥${TIER_THRESHOLDS.strong})`,
  tier2: `Tier 2 — ${TIER_META.developing.longLabel} (${TIER_THRESHOLDS.developing}–${TIER_THRESHOLDS.strong - 1})`,
  tier3: `Tier 3 — ${TIER_META.early.longLabel} (<${TIER_THRESHOLDS.developing})`,
};
const TIER_SHORT: Record<string, string> = { tier1: "Tier 1", tier2: "Tier 2", tier3: "Tier 3" };
const TIER_BADGE: Record<string, string> = {
  tier1: `badge badge-${TIER_META.strong.statusToken}`,
  tier2: `badge badge-${TIER_META.developing.statusToken}`,
  tier3: `badge badge-${TIER_META.early.statusToken}`,
};
const STATUS_LABELS: Record<string, string> = {
  new: "New", open: "Open", contacted: "Contacted", claimed: "Claimed",
  converted: "Converted", disqualified: "Disqualified",
};

const SORT_KEYS: SortKey[] = ["name", "maturity", "trustScore", "tier", "score", "status", "cost", "capturedAt"];

const MATURITY_OPTIONS = ["M0", "M1", "M2", "M3", "M4", "M5", "M6", "M7"] as const;
const TRUST_OPTIONS: { val: string; label: string }[] = [
  { val: "lt60", label: "Trust < 60" },
  { val: "gte60", label: "Trust ≥ 60" },
];
const DOSSIER_OPTIONS: { val: string; label: string }[] = [
  { val: "failed", label: "Dossier failed" },
  { val: "pending", label: "Dossier pending" },
];
const CONSENT_OPTIONS: { val: string; label: string }[] = [
  { val: "consented", label: "Consented" },
  { val: "awaiting", label: "Awaiting match" },
];

type Props = {
  searchParams: Promise<{
    tier?: string;
    status?: string;
    maturity?: string;
    trust?: string;
    dossier?: string;
    consent?: string;
    sort?: string;
    dir?: string;
    q?: string;
  }>;
};

export default async function AdminLeadsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");

  const params = await searchParams;
  const tierFilter = params.tier ?? "";
  const statusFilter = params.status ?? "";
  const maturityFilter = MATURITY_OPTIONS.includes(params.maturity as typeof MATURITY_OPTIONS[number])
    ? (params.maturity as LeadMaturity)
    : (null as LeadMaturity | null);
  const trustFilter = TRUST_OPTIONS.some((o) => o.val === params.trust) ? params.trust! : "";
  const dossierFilter = DOSSIER_OPTIONS.some((o) => o.val === params.dossier) ? params.dossier! : "";
  const consentFilter = CONSENT_OPTIONS.some((o) => o.val === params.consent) ? params.consent! : "";
  const q = (params.q ?? "").trim();
  // The awaiting-match queue defaults to oldest-first so the longest-waiting
  // consented leads surface at the top (work them before they go stale).
  const sort: SortKey = SORT_KEYS.includes(params.sort as SortKey)
    ? (params.sort as SortKey)
    : (consentFilter === "awaiting" ? "capturedAt" : "maturity");
  const dir: "asc" | "desc" = params.dir === "asc"
    ? "asc"
    : params.dir === "desc"
    ? "desc"
    : (consentFilter === "awaiting" && !params.sort ? "asc" : "desc");

  const where: Prisma.LeadWhereInput = {};
  if (tierFilter) where.tier = tierFilter;
  if (statusFilter) where.status = statusFilter;
  if (maturityFilter) where.maturity = maturityFilter as LeadMaturity;
  if (trustFilter === "lt60") where.trustScore = { lt: 60 };
  if (trustFilter === "gte60") where.trustScore = { gte: 60 };
  if (dossierFilter) where.dossierStatus = dossierFilter;
  if (consentFilter === "consented") where.applicantStatus = "approved";
  if (consentFilter === "awaiting") {
    where.applicantStatus = "approved";
    where.claimedByUserId = null;
    where.caseId = null;
    where.outcomes = { none: {} }; // not yet handed to a firm
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  const [leads, counts, costAgg, awaitingCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      take: 1000,
      include: { outcomes: { select: { pilotFirm: true }, take: 1, orderBy: { deliveredAt: "desc" } } },
    }),
    prisma.lead.groupBy({ by: ["tier"], _count: { id: true } }),
    prisma.llmUsage.groupBy({ by: ["leadId"], _sum: { cents: true }, where: { leadId: { not: null } } }),
    // Consented, unclaimed, and not yet delivered — the actionable match queue
    // (independent of active filters).
    prisma.lead.count({ where: { applicantStatus: "approved", claimedByUserId: null, caseId: null, outcomes: { none: {} } } }),
  ]);

  const tierCounts = Object.fromEntries(counts.map((c: { tier: string | null; _count: { id: number } }) => [c.tier, c._count.id]));
  const costByLead = new Map(costAgg.map((r: { leadId: string | null; _sum: { cents: number | null } }) => [r.leadId!, r._sum.cents ?? 0]));

  const rows: LeadRow[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    email: lead.email,
    maturity: lead.maturity,
    trustScore: lead.trustScore,
    tier: lead.tier,
    tierLabel: lead.tier ? (TIER_SHORT[lead.tier] ?? lead.tier) : null,
    score: lead.score,
    status: lead.status,
    statusLabel: STATUS_LABELS[lead.status] ?? lead.status,
    dossierStatus: lead.dossierStatus,
    cost: costByLead.has(lead.id) ? (costByLead.get(lead.id) ?? 0) : null,
    capturedAt: lead.capturedAt.toISOString(),
    claimed: Boolean(lead.claimedByUserId || lead.caseId),
    consented: lead.applicantStatus === "approved",
    delivered: lead.outcomes.length > 0,
    deliveredFirm: lead.outcomes[0]?.pilotFirm ?? null,
    awaitingMatch: lead.applicantStatus === "approved" && !lead.claimedByUserId && !lead.caseId && lead.outcomes.length === 0,
    betaInvited: Boolean(lead.betaInvitedAt),
    // Eligible for a self-petitioner beta invite regardless of matching consent:
    // not already invited, not claimed/converted, and not in the attorney pipeline.
    betaEligible: !lead.betaInvitedAt && !lead.claimedByUserId && !lead.caseId && lead.outcomes.length === 0,
    snippet: buildSnippet(lead.formData),
  }));

  // In-memory sort (lets us order by computed cost too). Nulls always sort last.
  const mul = dir === "asc" ? 1 : -1;
  const cmp = (a: LeadRow, b: LeadRow): number => {
    switch (sort) {
      case "name": return mul * (a.name ?? "").localeCompare(b.name ?? "");
      case "maturity": return mul * a.maturity.localeCompare(b.maturity);
      case "status": return mul * a.status.localeCompare(b.status);
      case "tier": return mul * (a.tier ?? "~").localeCompare(b.tier ?? "~");
      case "trustScore": return mul * (a.trustScore - b.trustScore);
      case "score": return mul * ((a.score ?? -1) - (b.score ?? -1));
      case "cost": return mul * ((a.cost ?? -1) - (b.cost ?? -1));
      case "capturedAt": return mul * (Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
      default: return 0;
    }
  };
  rows.sort(cmp);

  const csvHref = `/api/leads?format=csv${tierFilter ? `&tier=${tierFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Lead Pipeline</h1>
          <p className="mt-0.5 text-sm text-text-secondary">Applicants who completed the eligibility check</p>
        </div>
        <a href={csvHref} className="btn btn-secondary text-sm">Export CSV</a>
      </div>

      {/* Match queue: consented leads no attorney has claimed yet */}
      {awaitingCount > 0 && (
        <Link
          href="/admin/leads?consent=awaiting"
          className={`group flex items-center justify-between gap-4 rounded-xl border bg-info-bg px-5 py-4 transition-colors ${consentFilter === "awaiting" ? "border-info-text/40" : "border-info-border hover:border-info-text/40"}`}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-soft text-info-text">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-info-text">
                {awaitingCount} consented {awaitingCount === 1 ? "lead is" : "leads are"} awaiting an attorney
              </p>
              <p className="text-xs text-info-text/80">
                Consented to be matched — no firm has claimed them yet.
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-medium text-info-text group-hover:underline">
            {consentFilter === "awaiting" ? "Showing queue" : "Show queue →"}
          </span>
        </Link>
      )}

      {/* Tier summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["tier1", "tier2", "tier3"] as const).map((t) => (
          <Link
            key={t}
            href={`/admin/leads?tier=${t}`}
            className={`card card-interactive ${tierFilter === t ? "border-border-strong bg-surface-muted" : ""}`}
          >
            <div className={TIER_BADGE[t] ?? "badge badge-neutral"}>{t.toUpperCase()}</div>
            <div className="mt-2 text-2xl font-bold text-text-primary">{tierCounts[t] ?? 0}</div>
            <div className="text-xs text-text-muted">{TIER_LABELS[t]}</div>
          </Link>
        ))}
      </div>

      {/* Search */}
      <form method="get" className="flex gap-2">
        {tierFilter && <input type="hidden" name="tier" value={tierFilter} />}
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <input type="hidden" name="sort" value={sort} />
        <input type="hidden" name="dir" value={dir} />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search name or email…"
          className="flex-1 rounded-lg border border-border-default bg-surface-card px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-border-strong focus:outline-none"
        />
        <button type="submit" className="btn btn-secondary text-sm">Search</button>
        {q && <Link href={`/admin/leads${tierFilter ? `?tier=${tierFilter}` : ""}`} className="btn btn-ghost text-sm self-center">Clear</Link>}
      </form>

      {/* Filters */}
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-text-muted">Tier:</span>
          <Link
            href="/admin/leads"
            className={`rounded-full border px-3 py-1 transition-colors ${!tierFilter && !statusFilter && !maturityFilter && !trustFilter && !dossierFilter && !consentFilter ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
          >
            All
          </Link>
          {Object.entries(TIER_LABELS).map(([val, label]) => (
            <Link
              key={val}
              href={`/admin/leads?tier=${val}${statusFilter ? `&status=${statusFilter}` : ""}`}
              className={`rounded-full border px-3 py-1 transition-colors ${tierFilter === val ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
            >
              {label.split(" — ")[0]}
            </Link>
          ))}
          <span className="mx-1 self-center text-border-default">|</span>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <Link
              key={val}
              href={`/admin/leads?status=${val}${tierFilter ? `&tier=${tierFilter}` : ""}`}
              className={`rounded-full border px-3 py-1 transition-colors ${statusFilter === val ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-text-muted">Maturity:</span>
          {MATURITY_OPTIONS.map((m) => (
            <Link
              key={m}
              href={`/admin/leads?maturity=${m}${tierFilter ? `&tier=${tierFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
              className={`rounded-full border px-3 py-1 transition-colors ${maturityFilter === m ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
            >
              {m}
            </Link>
          ))}
          <span className="mx-1 self-center text-border-default">|</span>
          {TRUST_OPTIONS.map((o) => (
            <Link
              key={o.val}
              href={`/admin/leads?trust=${o.val}${tierFilter ? `&tier=${tierFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
              className={`rounded-full border px-3 py-1 transition-colors ${trustFilter === o.val ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
            >
              {o.label}
            </Link>
          ))}
          <span className="mx-1 self-center text-border-default">|</span>
          {DOSSIER_OPTIONS.map((o) => (
            <Link
              key={o.val}
              href={`/admin/leads?dossier=${o.val}${tierFilter ? `&tier=${tierFilter}` : ""}${statusFilter ? `&status=${statusFilter}` : ""}`}
              className={`rounded-full border px-3 py-1 transition-colors ${dossierFilter === o.val ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-text-muted">Consent:</span>
          {CONSENT_OPTIONS.map((o) => (
            <Link
              key={o.val}
              href={`/admin/leads?consent=${o.val}${tierFilter ? `&tier=${tierFilter}` : ""}`}
              className={`rounded-full border px-3 py-1 transition-colors ${consentFilter === o.val ? "border-border-inverted bg-surface-inverted text-text-inverted" : "border-border-default hover:border-border-strong"}`}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Leads table */}
      {rows.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">
            No leads{q || tierFilter || statusFilter || maturityFilter || trustFilter || dossierFilter || consentFilter ? " match" : " yet"}
          </p>
          <p className="empty-state-body">
            {q || tierFilter || statusFilter || maturityFilter || trustFilter || dossierFilter || consentFilter ? (
              <Link href="/admin/leads" className="underline">Clear filters</Link>
            ) : (
              <><Link href="/check" className="underline">Send someone to /check</Link> to capture the first one.</>
            )}
          </p>
        </div>
      ) : (
        <LeadsTable
          rows={rows}
          sort={sort}
          dir={dir}
          tier={tierFilter || undefined}
          status={statusFilter || undefined}
          maturity={maturityFilter || undefined}
          trust={trustFilter || undefined}
          dossier={dossierFilter || undefined}
          consent={consentFilter || undefined}
          q={q || undefined}
        />
      )}
    </div>
  );
}
