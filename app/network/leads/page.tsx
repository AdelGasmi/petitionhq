import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSubscriptionActive } from "@/lib/plans";
import { TIER_META, legacyTierToCanonical } from "@/lib/scoring";
import { hasCompletedDeepIntake, M7_TRUST_THRESHOLD } from "@/lib/leadMaturity";
import { Check, AlertTriangle } from "@/components/icons";
import { Stat } from "@/components/Stat";
import { SortSelect } from "./SortSelect";
import { LEVEL_LABEL, type VerificationLevel } from "@/lib/verification/level";
import { deriveCommercialFlags, type CommercialFlags } from "@/lib/commercialFlags";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

const TIER_LABEL: Record<string, string> = {
  tier1: `Tier 1 — ${TIER_META.strong.longLabel}`,
  tier2: `Tier 2 — ${TIER_META.developing.longLabel}`,
  tier3: `Tier 3 — ${TIER_META.early.longLabel}`,
};

type VerifiedClaim = { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string };

// Marketplace cards are pre-claim — suppress claim details that could de-anonymize.
// Institution name (field+institution+citations = findable) and any legacy ORCID IDs
// in the detail text must not appear here.
function safeChipLabel(key: string, claim: VerifiedClaim): string {
  if (key === "institution") return "Institution verified";
  if (key === "orcid" && claim.detail) {
    const stripped = claim.detail.replace(/ORCID\s+[\dX-]+,?\s*/gi, "").trim();
    return stripped || "ORCID verified";
  }
  return claim.detail ?? key.replace(/_/g, " ");
}

function formatRecency(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days === 0) return "Captured today";
  if (days === 1) return "Captured yesterday";
  return `Captured ${days}d ago`;
}

function isNewThisWeek(date: Date): boolean {
  return Date.now() - date.getTime() < 7 * 86_400_000;
}

const DEMO_LEADS = [
  { id: "demo-1", tier: "tier1", score: 82, field: "Machine Learning", degree: "PhD", publications: "8", citations: "210", experience: "6y", awards: "Best Paper Award", grants: "NSF CAREER", trustScore: 85, capturedAt: new Date(Date.now() - 2 * 86_400_000), verifiedClaims: { researcher_profile: { status: "verified", source: "openalex", detail: "8 publications, 210 citations", confidence: 0.92 }, institution: { status: "verified", source: "ror", detail: "Stanford University", confidence: 0.95 }, nsf_grants: { status: "verified", source: "nsf", detail: "NSF CAREER Award", confidence: 0.88 }, awards: { status: "self_reported", source: "openalex", detail: "Best Paper Award", confidence: 0 } } as Record<string, VerifiedClaim>, commercialFlags: deriveCommercialFlags({ usPlan: "Funded position, signed agreement, or active collaboration", employerSituation: "My research is self-directed — no single employer applies", nationalConnection: "I can name a specific federal program or agency priority" }) },
  { id: "demo-2", tier: "tier1", score: 78, field: "Structural Biology", degree: "PhD", publications: "5", citations: "140", experience: "8y", awards: null, grants: "NIH R01", trustScore: 72, capturedAt: new Date(Date.now() - 5 * 86_400_000), verifiedClaims: { researcher_profile: { status: "verified", source: "openalex", detail: "5 publications, 140 citations", confidence: 0.85 }, nih_grants: { status: "verified", source: "nih", detail: "NIH R01", confidence: 0.9 } } as Record<string, VerifiedClaim>, commercialFlags: deriveCommercialFlags({ usPlan: "Named institution, lab, or collaborator in mind", employerSituation: "No employer has offered sponsorship", nationalConnection: "General benefit to the US (no specific program)" }) },
  { id: "demo-3", tier: "tier2", score: 64, field: "Computational Genomics", degree: "PhD", publications: "3", citations: "55", experience: "4y", awards: null, grants: null, trustScore: 45, capturedAt: new Date(Date.now() - 10 * 86_400_000), verifiedClaims: { researcher_profile: { status: "verified", source: "openalex", detail: "3 publications, 55 citations", confidence: 0.72 } } as Record<string, VerifiedClaim>, commercialFlags: deriveCommercialFlags({ usPlan: "No specific plan yet", employerSituation: "I have an employer who could sponsor me through PERM", nationalConnection: "No clear connection" }) },
];

type SortKey = "newest" | "score" | "trust";

type Props = { searchParams: Promise<{ demo?: string; onboarded?: string; subscribed?: string; tier?: string; sort?: string; cursor?: string }> };

export default async function NetworkLeadsPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    redirect("/login");
  }

  const params = await searchParams;
  const isDemo = params.demo === "1";
  const tierFilter = params.tier;
  const validTiers = ["tier1", "tier2", "tier3"];
  const activeTier = tierFilter && validTiers.includes(tierFilter) ? tierFilter : null;
  const sortKey: SortKey = (["newest", "score", "trust"].includes(params.sort ?? "") ? params.sort : "newest") as SortKey;
  const cursor = params.cursor ? new Date(params.cursor) : null;

  const subscribed = session.role === "attorney"
    ? await isSubscriptionActive(session.userId)
    : true;

  const [claimedCount, convertedCount] = session.role === "attorney"
    ? await Promise.all([
        prisma.lead.count({ where: { claimedByUserId: session.userId } }),
        prisma.lead.count({ where: { claimedByUserId: session.userId, caseId: { not: null } } }),
      ])
    : [0, 0];

  const isAdmin = session?.role === "admin";

  const orderBy = sortKey === "score"
    ? [{ score: "desc" as const }, { orcidAuthenticated: "desc" as const }, { capturedAt: "desc" as const }]
    : sortKey === "trust"
    ? [{ trustScore: "desc" as const }, { orcidAuthenticated: "desc" as const }, { capturedAt: "desc" as const }]
    : [{ capturedAt: "desc" as const }]; // "newest" keeps chronological order unchanged

  const dbLeads = isDemo ? [] : await prisma.lead.findMany({
    where: {
      ...(activeTier ? { tier: activeTier } : {}),
      claimedByUserId: null,
      ...(!isAdmin ? { maturity: "M7" } : {}),
      // Cursor-based pagination: for "newest" sort, use capturedAt < cursor
      ...(cursor && sortKey === "newest" ? { capturedAt: { lt: cursor } } : {}),
    },
    orderBy,
    take: PAGE_SIZE + 1, // fetch one extra to detect next page
  });

  // Defense-in-depth: the M7 gate is now enforced at verification time, but
  // also screen the marketplace list so any historically mis-graded lead
  // (incomplete deep intake, or sub-threshold trust from before the gate) is
  // never shown to attorneys. Admins still see everything.
  const marketLeads = isAdmin
    ? dbLeads
    : dbLeads.filter(
        (l) =>
          hasCompletedDeepIntake(l.formData as Record<string, unknown> | null) &&
          (l.trustScore ?? 0) >= M7_TRUST_THRESHOLD,
      );

  const hasNextPage = marketLeads.length > PAGE_SIZE;
  const pageLeads = hasNextPage ? marketLeads.slice(0, PAGE_SIZE) : marketLeads;
  const nextCursor = hasNextPage && sortKey === "newest" && pageLeads.length > 0
    ? pageLeads[pageLeads.length - 1].capturedAt.toISOString()
    : null;

  const leads = isDemo
    ? DEMO_LEADS
    : pageLeads.map((l) => {
        const fd = l.formData as Record<string, unknown> | null;
        const vc = l.verifiedClaims as Record<string, VerifiedClaim> | null;
        return {
          id: l.id,
          tier: l.tier ?? "tier2",
          score: l.score,
          field: fd ? String(fd.field ?? "Research") : "Research",
          degree: fd ? String(fd.degree ?? "—") : "—",
          publications: fd ? String(fd.publications ?? "—") : "—",
          citations: fd ? String(fd.citations ?? "—") : "—",
          // yearsExperience is a descriptive string ("More than 10 years",
          // "5-10 years"); only append "y" when it's a bare number.
          experience: fd?.yearsExperience
            ? (/^\d+$/.test(String(fd.yearsExperience)) ? `${fd.yearsExperience}y` : String(fd.yearsExperience))
            : null,
          awards: fd?.awards ? String(fd.awards) : null,
          grants: fd?.grants ? String(fd.grants) : null,
          trustScore: l.trustScore,
          capturedAt: l.capturedAt,
          verifiedClaims: vc ?? null,
          commercialFlags: deriveCommercialFlags(fd),
        };
      });

  const toast = params.onboarded === "1"
    ? "Welcome! Your firm profile is set up."
    : params.subscribed === "1"
    ? "Subscription active — you can now claim leads."
    : null;

  // Build URL preserving current filters + changing one param
  function buildUrl(overrides: Record<string, string | null>) {
    const base: Record<string, string> = {};
    if (isDemo) base.demo = "1";
    if (activeTier) base.tier = activeTier;
    if (sortKey !== "newest") base.sort = sortKey;
    const merged = { ...base, ...overrides };
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(v as string)}`)
      .join("&");
    return `/network/leads${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {isDemo && (
        <div className="rounded-xl border border-warning-border bg-warning-bg px-5 py-3 text-sm text-warning-text flex items-center justify-between">
          <span>Demo mode — showing sample leads. Claims are not charged.</span>
          <Link href="/network/leads" className="underline text-warning-text">Exit demo</Link>
        </div>
      )}
      {toast && (
        <div className="rounded-xl border border-success-border bg-success-bg px-5 py-3 text-sm text-success-text">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Available Cases</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            {leads.length > 0
              ? `${leads.length}${hasNextPage ? "+" : ""} available lead${leads.length !== 1 ? "s" : ""}`
              : "Unclaimed leads available for review"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isDemo && (
            <Link href="/network/leads?demo=1" className="btn btn-secondary text-xs">
              View demo
            </Link>
          )}
        </div>
      </div>

      {session.role === "attorney" && !isDemo && (
        <>
          {!subscribed && (
            <div className="rounded-xl border border-warning-border bg-warning-bg px-5 py-3 text-sm text-warning-text flex items-center justify-between">
              <span>Subscribe to claim leads from the marketplace.</span>
              <Link href="/network/billing" className="btn btn-primary text-xs">Subscribe — $99/mo</Link>
            </div>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Stat label="Leads Claimed" value={claimedCount} />
            <Stat label="Cases Converted" value={convertedCount} />
          </div>
        </>
      )}

      {/* Filters + sort row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="filter-pill-row">
          {[
            { key: null, label: "All tiers" },
            { key: "tier1", label: `Tier 1 — ${TIER_META.strong.label}` },
            { key: "tier2", label: `Tier 2 — ${TIER_META.developing.label}` },
            { key: "tier3", label: `Tier 3 — ${TIER_META.early.label}` },
          ].map(({ key, label }) => {
            const isActive = activeTier === key || (!activeTier && !key);
            return (
              <Link
                key={label}
                href={buildUrl({ tier: key, cursor: null })}
                className="filter-pill"
                data-active={isActive ? "true" : undefined}
                aria-current={isActive ? "true" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <SortSelect value={sortKey} baseUrl={buildUrl({ sort: null, cursor: null })} />
      </div>

      {leads.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No unclaimed cases right now</p>
          <p className="empty-state-body">New leads appear here as applicants complete their assessment.</p>
          <Link href="/network/leads?demo=1" className="btn btn-secondary text-sm">
            Try the demo →
          </Link>
        </div>
      ) : (
        <div className="cards-enter space-y-2">
          {leads.map((lead) => {
            const vc = lead.verifiedClaims;
            const HIDDEN_VC_KEYS = ["preliminary", "_breakdown", "_aggregate", "_verificationLevel"];
            const vcEntries = vc
              ? Object.entries(vc).filter(([k]) => !HIDDEN_VC_KEYS.includes(k))
              : [];
            // A "verified" chip that reports a zero/empty finding (e.g.
            // "0 publications", "None found") reads as a positive ✓ but says
            // nothing was found — confusing next to real corroboration chips.
            // Drop those so chips only surface substantive findings.
            const verified = vcEntries.filter(
              ([, c]) => c.status === "verified" && !/^\s*(0\b|none\b|no\s)/i.test(c.detail ?? ""),
            );
            const selfReported = vcEntries.filter(([, c]) => c.status === "self_reported");
            const hasVerification = vcEntries.length > 0;
            const level = (vc?.["_verificationLevel"]?.detail ?? null) as VerificationLevel | null;
            const ts = lead.trustScore;
            const isNew = isNewThisWeek(lead.capturedAt);
            const recency = formatRecency(lead.capturedAt);
            const cf = lead.commercialFlags as CommercialFlags;
            const cfDotCls: Record<string, string> = {
              green: "bg-success-text",
              yellow: "bg-warning-text",
              grey: "bg-border-default",
            };

            // Fixed slot order for scan-ability: max 3 verified + 1 self-reported chip, then overflow count
            const CHIP_CAP = 3;
            const visibleVerified = verified.slice(0, CHIP_CAP);
            const overflowCount = verified.length - visibleVerified.length + (selfReported.length > 0 ? 1 : 0);
            const showSelfReported = selfReported.length > 0 && visibleVerified.length < CHIP_CAP;

            return (
            <div key={lead.id} className="rounded-xl border border-border-default bg-surface-card px-4 py-3.5 sm:px-6">
              {/* Row 1: tier badge → field → trust chip (fixed order, no wrap spillover) */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`badge badge-${TIER_META[legacyTierToCanonical(lead.tier)].statusToken} shrink-0`}>
                  {TIER_LABEL[lead.tier] ?? lead.tier}
                </span>
                {isNew && (
                  <span className="badge badge-info shrink-0">New</span>
                )}
                <span className="text-sm font-medium text-text-secondary truncate flex-1 min-w-0">{lead.field}</span>
                {/* Trust chip — always last in row 1 */}
                {ts != null && ts > 0 && (
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${
                    ts >= 60 ? "bg-success-soft text-success-text"
                    : ts >= 40 ? "bg-warning-soft text-warning-text"
                    : "bg-danger-soft text-danger-text"
                  }`}>
                    {ts}/100
                  </span>
                )}
              </div>

              {/* Row 2: metrics → recency → CTA (fixed slot) */}
              <div className="mt-1.5 flex items-center gap-3 text-xs text-text-muted min-w-0">
                <span className="shrink-0">{lead.degree}{lead.experience ? ` · ${lead.experience}` : ""}</span>
                <span className="shrink-0">
                  <strong className="text-text-secondary">{lead.publications}</strong> pubs
                  {" · "}
                  <strong className="text-text-secondary">{lead.citations}</strong> cit.
                </span>
                {lead.awards && (
                  <span className="hidden sm:inline truncate max-w-[120px] text-warning-text">{lead.awards}</span>
                )}
                <span className="ml-auto shrink-0">{recency}</span>
                {/* Demo fixtures have no detail page — an inert chip beats a
                    404 in the middle of a live demo. */}
                {isDemo ? (
                  <span className="badge badge-neutral shrink-0" title="Sample lead — real leads open a full evaluation page">
                    Sample
                  </span>
                ) : (
                  <Link
                    href={`/leads/${lead.id}`}
                    className="btn btn-secondary text-xs shrink-0 py-1"
                  >
                    Review →
                  </Link>
                )}
              </div>

              {/* Row 3: verification level + evidence chips */}
              <div className="mt-2 flex items-center gap-1.5 flex-wrap border-t border-border-subtle pt-2">
                {/* Level chip — always first when present */}
                {level && (
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${
                    level === "identity_confirmed"
                      ? "bg-success-bg border-success-border text-success-text"
                      : level === "publicly_corroborated"
                      ? "bg-info-bg border-info-border text-info-text"
                      : "bg-surface-subtle border-border-default text-text-muted"
                  }`}>
                    {level === "identity_confirmed" && <Check className="h-3 w-3 shrink-0" />}
                    {LEVEL_LABEL[level]}
                  </span>
                )}
                {hasVerification ? (
                  <>
                    {visibleVerified.map(([key, claim]) => (
                      <span key={key} className="inline-flex items-center gap-1 rounded-full bg-success-bg border border-success-border px-2 py-0.5 text-xs text-success-text">
                        <Check className="h-3 w-3 text-success-fill shrink-0" />
                        <span className="truncate max-w-[120px]">{safeChipLabel(key, claim)}</span>
                      </span>
                    ))}
                    {showSelfReported && selfReported[0] && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg border border-warning-border px-2 py-0.5 text-xs text-warning-text">
                        <AlertTriangle className="h-3 w-3 text-warning-fill shrink-0" />
                        <span className="truncate max-w-[120px]">{safeChipLabel(selfReported[0][0], selfReported[0][1])}</span>
                      </span>
                    )}
                    {overflowCount > 0 && (
                      <span className="text-xs text-text-muted">+{overflowCount} more</span>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-text-muted italic">Verification pending</span>
                )}
                {/* Commercial signal dots — US Plan · Self-petition · National hook */}
                <span className="ml-auto flex items-center gap-1" aria-label="Commercial signals">
                  {[cf.usPlan, cf.selfPetitionFit, cf.nationalHook].map((f) => (
                    <span key={f.label} title={`${f.label}: ${f.value}`}
                      className={`h-2 w-2 rounded-full shrink-0 ${cfDotCls[f.color]}`}
                    />
                  ))}
                </span>
              </div>
            </div>
            );
          })}

          {/* Load more — cursor pagination (newest sort only) */}
          {nextCursor && (
            <div className="pt-2 text-center">
              <Link
                href={buildUrl({ cursor: nextCursor })}
                className="btn btn-secondary text-sm"
              >
                Load more
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
