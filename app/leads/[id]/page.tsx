import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExhibitRows } from "@/lib/exhibitPlan";
import { readCase } from "@/lib/db";
import { ClaimButton } from "./ClaimButton";
import { BriefDownloadButton } from "./BriefDownloadButton";
import { NotifyButton } from "./NotifyButton";
import { CallOutcomeButtons } from "./CallOutcomeButtons";
import { ReleaseButton } from "./ReleaseButton";
import { RequeueDossierButton } from "./RequeueDossierButton";
import { legacyTierToCanonical, TIER_META } from "@/lib/scoring";
import { hasCompletedDeepIntake, M7_TRUST_THRESHOLD } from "@/lib/leadMaturity";
import { VerificationPanel } from "@/components/admin/VerificationPanel";
import { VerificationDetails } from "@/components/leads/VerificationDetails";
import { RefundRequestButton } from "@/components/attorney/RefundRequestButton";
import { verifyToken } from "@/lib/tokens";
import { extractEvidence } from "@/lib/drafting";
import { isAtomKindVerified } from "@/lib/claimBadge";
import { ClaimGate, type GateAtom } from "./ClaimGate";
import { Lock } from "@/components/icons";
import { StickyClaimBar } from "./StickyClaimBar";
import { deriveCommercialFlags } from "@/lib/commercialFlags";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  tier1: `Tier 1 — ${TIER_META.strong.longLabel}`,
  tier2: `Tier 2 — ${TIER_META.developing.longLabel}`,
  tier3: `Tier 3 — ${TIER_META.early.longLabel}`,
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ token?: string }> };

export default async function LeadDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  const session = await getSession();

  // Allow access via session (admin/attorney) or preview token (for cold-email links)
  if (!session && !token) redirect("/login");
  if (session && session.role !== "admin" && session.role !== "attorney") redirect("/");

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      claimPayment: { select: { status: true } },
      verificationEvents: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          source: true,
          action: true,
          result: true,
          claimKey: true,
          evidenceRef: true,
          confidenceScore: true,
          createdAt: true,
        },
      },
    },
  });
  if (!lead) notFound();

  // M7 visibility enforcement: attorneys can only see attorney-ready leads.
  // Pre-claim (marketplace discovery) the lead must be fully ready — M7 AND a
  // completed deep intake AND trust above threshold — so a half-baked or
  // uncorroborated lead is never viewable. A lead the attorney already claimed
  // is always accessible to its owner.
  if (session?.role === "attorney") {
    const claimedByViewer = lead.claimedByUserId === session.userId;
    const fd = lead.formData as Record<string, unknown> | null;
    const marketReady =
      lead.maturity === "M7" &&
      hasCompletedDeepIntake(fd) &&
      lead.trustScore >= M7_TRUST_THRESHOLD;
    if (!claimedByViewer && !marketReady) {
      notFound();
    }
  }

  // Verify signed preview token (SHA-256 hashed, 24h TTL)
  if (!session) {
    if (!token) redirect("/login");
    const verified = await verifyToken(token, "lead_preview");
    if (!verified || verified.subjectId !== id) {
      return (
        <div className="mx-auto max-w-md py-20 text-center space-y-4">
          <p className="font-serif text-xl">This preview link has expired.</p>
          <p className="text-sm text-text-muted">Please sign in or contact the platform team for access.</p>
        </div>
      );
    }
  }

  const tier = lead.tier ?? "tier3";
  const field = (() => {
    const fd = lead.formData as Record<string, unknown> | null;
    return fd ? String(fd.field ?? "Research") : "Research";
  })();

  // Build exhibit plan if case exists
  let exhibitRows: ReturnType<typeof buildExhibitRows> = [];
  let prong1Teaser = "";
  let gateAtoms: GateAtom[] = [];
  let gateInitialApproved: string[] = [];
  let gateAttested: { ledgerRoot: string; attestedAt: string } | null = null;

  if (lead.caseId) {
    const c = await readCase(lead.caseId);
    if (c) {
      exhibitRows = buildExhibitRows(c.formData ?? {}, c.letters);
      // Check if a brief section draft exists for prong1-merit
      const briefSections = (c.formData.briefSections ?? {}) as Record<string, unknown>;
      const prong1 = briefSections["prong1-merit"] as string | undefined;
      if (prong1) {
        const words = prong1.split(/\s+/);
        prong1Teaser = words.slice(0, 200).join(" ") + (words.length > 200 ? "…" : "");
      }

      // Claim-curation gate: live atoms + Fork-C verification badges.
      const vc = lead.verifiedClaims as Record<string, { status: string }> | null;
      gateAtoms = extractEvidence(c.formData ?? {}).map((a) => ({
        id: a.id,
        kind: a.kind,
        summary: a.summary,
        detail: a.detail,
        year: a.year,
        metric: a.metric,
        verified: isAtomKindVerified(a.kind, vc),
      }));
      const ledger = c.claimLedger ?? null;
      // null ⇒ un-curated ⇒ seed every atom approved (Fork B: preview never blank).
      gateInitialApproved =
        ledger && Array.isArray(ledger.approved)
          ? ledger.approved
          : gateAtoms.map((a) => a.id);
      gateAttested =
        ledger?.attestedAt && ledger?.ledgerRoot
          ? { ledgerRoot: ledger.ledgerRoot, attestedAt: ledger.attestedAt }
          : null;
    }
  }

  const isClaimed = !!lead.claimedByUserId;
  const isAdmin = session?.role === "admin";
  // Source links de-anonymize the applicant — only the owning attorney sees them.
  const isClaimedByViewer = !!session && lead.claimedByUserId === session.userId;
  const hasPayment = lead.claimPayment?.status === "completed";

  const refundRequest = (isClaimed && !isAdmin && lead.caseId && session)
    ? await prisma.refundRequest.findFirst({
        where: { caseId: lead.caseId, attorneyId: session.userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, reason: true, createdAt: true, decidedAt: true },
      })
    : null;

  const claimedAt = lead.claimedAt ? new Date(lead.claimedAt) : null;
  const refundWindowEnd = claimedAt
    ? new Date(claimedAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;
  const refundWindowOpen = refundWindowEnd ? new Date() < refundWindowEnd : false;

  const tierMeta = TIER_META[legacyTierToCanonical(tier)];

  return (
    <div className="mx-auto max-w-5xl py-8">
      {/* Sticky claim bar — mobile only, pre-claim attorney */}
      {!isAdmin && !isClaimed && session?.role === "attorney" && (
        <StickyClaimBar
          leadId={lead.id}
          tierLabel={TIER_LABEL[tier] ?? tier}
          tierStatusToken={tierMeta.statusToken}
          trustScore={lead.trustScore}
          sentinelId="lead-header-sentinel"
        />
      )}

      <div className="lg:grid lg:grid-cols-[1fr_300px] lg:gap-8 lg:items-start space-y-8 lg:space-y-0">

        {/* ── Main column ── */}
        <div className="space-y-8">

          {/* Header */}
          <div id="lead-header-sentinel">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`badge badge-${tierMeta.statusToken}`}>
                    {TIER_LABEL[tier] ?? tier}
                  </span>
                  {lead.score !== null && (
                    isAdmin ? (
                      <span className="text-sm text-text-muted">Score: <strong className="text-text-primary">{lead.score}/100</strong></span>
                    ) : (
                      <span className="text-sm text-text-muted">Case strength: <strong className="text-text-primary tabular-nums">{tierMeta.range}</strong></span>
                    )
                  )}
                </div>
                <h1 className="font-serif text-2xl tracking-tight">
                  {isAdmin ? (lead.name || `Lead #${lead.id.slice(0, 8)}`) : `${field} Researcher`}
                </h1>
                <p className="text-sm text-text-muted">
                  EB-2 NIW — {isClaimed ? "Claimed" : "Available"}
                  {" · "}Captured {new Date(lead.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              {/* Mobile/sm CTAs — hidden on lg: where right rail takes over */}
              <div className="flex flex-col gap-2 sm:items-end lg:hidden">
                {!isAdmin && isClaimed && (
                  <a href={`/api/leads/${lead.id}/dossier`} target="_blank" rel="noreferrer" className="btn btn-primary text-sm">
                    View petition draft →
                  </a>
                )}
                {!isAdmin && isClaimed && lead.caseId && (
                  <BriefDownloadButton leadId={lead.id} />
                )}
                {!isAdmin && !isClaimed && (
                  <>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-subtle px-3 py-1.5 text-sm text-text-muted cursor-not-allowed" aria-disabled="true">
                      <Lock className="h-3.5 w-3.5" />
                      Full 8-Page Dossier Locked
                    </span>
                    {session?.role === "attorney" && (
                      <>
                        <ClaimButton leadId={lead.id} />
                        <p className="text-xs text-text-muted text-right max-w-[220px]">
                          Auto-refund if applicant doesn&apos;t complete intake in 14 days.
                        </p>
                      </>
                    )}
                  </>
                )}
                {!isClaimed && isAdmin && legacyTierToCanonical(lead.tier) !== "early" && lead.dossierStatus === "completed" && (
                  <NotifyButton leadId={lead.id} />
                )}
                {isAdmin && lead.dossierStatus === "failed" && lead.caseId && (
                  <RequeueDossierButton leadId={lead.id} />
                )}
                {isClaimed && isAdmin && (
                  <ReleaseButton leadId={lead.id} hasPayment={lead.claimPayment?.status === "completed"} />
                )}
                {!isAdmin && isClaimed && lead.caseId && (
                  <Link href={`/cases/${lead.caseId}`} className="btn btn-primary text-sm">
                    Open case workspace →
                  </Link>
                )}
              </div>
            </div>
          </div>

      {/* ── Attorney: Verification & Provenance (trust before evidence) ── */}
      {!isAdmin && lead.trustScore > 0 && lead.verifiedClaims && (
        <VerificationDetails
          trustScore={lead.trustScore}
          verifiedClaims={lead.verifiedClaims as Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }>}
          isClaimed={isClaimedByViewer}
        />
      )}

      {/* ── Attorney-only sections: profile → AI assessment → evidence → exhibit plan ── */}
      {!isAdmin && (() => {
        const fd = lead.formData as Record<string, unknown> | null;
        if (!fd) return null;

        const flags = deriveCommercialFlags(fd);
        const flagList = [flags.usPlan, flags.selfPetitionFit, flags.nationalHook];
        const colorCls: Record<string, string> = {
          green: "bg-success-bg border-success-border text-success-text",
          yellow: "bg-warning-bg border-warning-border text-warning-text",
          grey: "bg-surface-subtle border-border-default text-text-muted",
        };

        const core = [
          { label: "Degree", value: String(fd.degree ?? "—") },
          { label: "Experience", value: fd.yearsExperience ? `${fd.yearsExperience} years` : "—" },
          { label: "Publications", value: String(fd.publications ?? "—") },
          { label: "Citations", value: String(fd.citations ?? "—") },
        ].filter(s => s.value !== "—");

        const deep = [
          { label: "Patents", value: String(fd.patents ?? "—") },
          { label: "Awards", value: String(fd.awards ?? "—") },
          { label: "Grants", value: String(fd.grants ?? "—") },
          { label: "Peer review / editorial", value: String(fd.peerReview ?? "—") },
          { label: "Invited talks", value: String(fd.invitedTalks ?? "—") },
          { label: "National importance", value: String(fd.nationalConnection ?? "—") },
          { label: "US plan", value: String(fd.usPlan ?? "—") },
          { label: "Employer situation", value: String(fd.employerSituation ?? "—") },
        ].filter(s => s.value !== "—");

        const gap = fd._gapNarrative as { strengths?: string; blockers?: string; legalLeverage?: string } | undefined;
        const dims = fd._dimensions as { label: string; score: number; notes?: string }[] | undefined;
        const summary = fd._summary as string | undefined;
        const hasAssessment = !!(gap || dims?.length || summary);

        return (
          <>
            {/* 1. Commercial Fit (coarse) */}
            <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5">
              <h2 className="font-serif text-lg mb-1">Commercial Fit</h2>
              <p className="text-xs text-text-muted mb-4">Raw signals from intake — not scored, not weighted</p>
              <div className="grid grid-cols-3 gap-3">
                {flagList.map((f) => (
                  <div key={f.label} className={`rounded-lg border px-3 py-3 ${colorCls[f.color]}`}>
                    <div className="text-xs font-semibold uppercase tracking-wider opacity-70">{f.label}</div>
                    <div className="mt-1 text-sm font-semibold leading-snug">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Profile Snapshot */}
            {core.length > 0 && (
              <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5">
                <h2 className="font-serif text-lg mb-4">Profile Snapshot</h2>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
                  {core.map(s => (
                    <div key={s.label}>
                      <dt className="text-xs text-text-muted uppercase tracking-wider">{s.label}</dt>
                      <dd className="mt-0.5 text-sm font-medium text-text-primary">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {/* 3. AI Legal Assessment — the trust builder */}
            {hasAssessment && (
              <div className="rounded-xl border border-verify-border bg-gradient-to-b from-verify-bg to-surface-card px-6 py-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-verify-soft">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-verify-fill" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                  </div>
                  <h2 className="font-serif text-lg text-text-primary">AI Legal Assessment</h2>
                </div>
                {summary && <p className="text-sm text-text-secondary leading-relaxed">{summary}</p>}
                {Array.isArray(dims) && dims.length > 0 && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {dims.map((d) => (
                      <div key={d.label} className="rounded-lg bg-surface-card border border-verify-soft px-3 py-2">
                        <div className="text-xs text-text-muted uppercase tracking-wider">{d.label}</div>
                        <div className="mt-0.5 text-sm font-semibold text-text-primary">{d.score}/100</div>
                        <div className="mt-1 h-1.5 rounded-full bg-surface-muted">
                          <div className="h-1.5 rounded-full bg-verify-fill" style={{ width: `${Math.min(d.score, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {gap && (
                  <div className="space-y-3 border-t border-verify-soft pt-4">
                    {gap.strengths && (
                      <div>
                        <h3 className="text-xs font-semibold text-success-text uppercase tracking-wider mb-1">Strengths</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">{gap.strengths}</p>
                      </div>
                    )}
                    {gap.blockers && (
                      <div>
                        <h3 className="text-xs font-semibold text-warning-text uppercase tracking-wider mb-1">Blockers</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">{gap.blockers}</p>
                      </div>
                    )}
                    {gap.legalLeverage && (
                      <div>
                        <h3 className="text-xs font-semibold text-verify-text uppercase tracking-wider mb-1">Legal Leverage</h3>
                        <p className="text-sm text-text-secondary leading-relaxed">{gap.legalLeverage}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Detailed Evidence */}
            {deep.length > 0 && (
              <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5">
                <h2 className="font-serif text-lg mb-4">Detailed Evidence</h2>
                <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
                  {deep.map(s => (
                    <div key={s.label} className="border-b border-border-subtle pb-2 last:border-0">
                      <dt className="text-xs text-text-muted uppercase tracking-wider">{s.label}</dt>
                      <dd className="mt-0.5 text-sm text-text-primary">{s.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </>
        );
      })()}

      {/* Admin: verification panel + privacy note */}
      {isAdmin && (
        <>
          <VerificationPanel
            leadId={lead.id}
            trustScore={lead.trustScore}
            verifiedClaims={(lead.verifiedClaims ?? null) as Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string; verifiedAt?: string }> | null}
            events={lead.verificationEvents.map((e) => ({
              ...e,
              claimKey: e.claimKey ?? null,
              evidenceRef: e.evidenceRef ?? null,
              confidenceScore: e.confidenceScore ?? null,
              createdAt: e.createdAt.toISOString(),
            }))}
            lastVerifiedAt={lead.lastVerifiedAt?.toISOString() ?? null}
            maturity={lead.maturity}
            adminAttested={lead.adminAttested}
            adminAttestedBy={lead.adminAttestedBy ?? null}
            adminAttestedAt={lead.adminAttestedAt?.toISOString() ?? null}
            adminAttestedReason={lead.adminAttestedReason ?? null}
          />

          {/* Applicant contact card */}
          <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5">
            <h2 className="font-serif text-lg mb-3">Applicant</h2>
            <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-8">
              <div>
                <dt className="text-xs text-text-muted uppercase tracking-wider">Name</dt>
                <dd className="mt-0.5 text-sm font-medium text-text-primary">{lead.name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-text-muted uppercase tracking-wider">Email</dt>
                <dd className="mt-0.5 text-sm text-text-primary">
                  <a href={`mailto:${lead.email}`} className="underline hover:text-text-secondary">{lead.email}</a>
                </dd>
              </div>
              {(() => {
                const fd = lead.formData as Record<string, unknown> | null;
                const field2 = fd ? String(fd.field ?? "") : "";
                const institution = fd ? String(fd.institution ?? "") : "";
                return (
                  <>
                    {field2 && (
                      <div>
                        <dt className="text-xs text-text-muted uppercase tracking-wider">Field</dt>
                        <dd className="mt-0.5 text-sm text-text-primary">{field2}</dd>
                      </div>
                    )}
                    {institution && (
                      <div>
                        <dt className="text-xs text-text-muted uppercase tracking-wider">Institution</dt>
                        <dd className="mt-0.5 text-sm text-text-primary">{institution}</dd>
                      </div>
                    )}
                  </>
                );
              })()}
            </dl>
          </div>
        </>
      )}

      {/* Call outcome — claimed leads only (attorney + admin for pipeline management) */}
      {isClaimed && session && (session.role === "attorney" || session.role === "admin") && (
        <CallOutcomeButtons leadId={lead.id} initial={lead.callOutcome} />
      )}

      {/* Exhibit plan — attorney only */}
      {!isAdmin && exhibitRows.length > 0 && (
        <div className="rounded-xl border border-border-default bg-surface-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <h2 className="font-serif text-lg">Exhibit Plan</h2>
            <p className="text-xs text-text-muted mt-0.5">Evidence mapped to Dhanasar prongs</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-subtle">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-24">Prong</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-48">Item</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {exhibitRows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-surface-card" : "bg-surface-subtle"}>
                  <td className="px-4 py-2.5 text-xs font-semibold text-text-muted">{row.prong}</td>
                  <td className="px-4 py-2.5 font-medium text-text-primary">{row.item}</td>
                  <td className="px-4 py-2.5 text-text-secondary text-xs">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Claim-curation gate — claiming attorney only, post-claim */}
      {!isAdmin && isClaimedByViewer && lead.caseId && gateAtoms.length > 0 && (
        <ClaimGate
          leadId={lead.id}
          atoms={gateAtoms}
          initialApproved={gateInitialApproved}
          attested={gateAttested}
        />
      )}

      {/* Prong 1 teaser — attorney only */}
      {!isAdmin && prong1Teaser && (
        <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5 space-y-3">
          <h2 className="font-serif text-lg">Prong 1 — Draft Preview</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{prong1Teaser}</p>
          {!isClaimed && (
            <p className="text-xs text-text-muted border-t border-dashed border-border-default pt-3">
              Full draft (Prong 1, 2, 3 + recommendation letters) available after claiming.
            </p>
          )}
        </div>
      )}

      {/* No exhibit data — attorney pre-claim */}
      {!isAdmin && !isClaimed && exhibitRows.length === 0 && !prong1Teaser && (
        <div className="rounded-xl border border-border-default bg-surface-subtle px-6 py-5 space-y-2">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Pre-Retention Profile</h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            This lead has completed the deep assessment and consented to an attorney match.
            Once you claim this lead and they retain your firm, the applicant will unlock
            the secure intake portal to upload their evidence, at which point the platform
            will generate your exhibit plan and drafted dossier.
          </p>
        </div>
      )}

      {/* No exhibit data — attorney post-claim */}
      {!isAdmin && isClaimed && exhibitRows.length === 0 && !prong1Teaser && (
        <div className="rounded-xl border border-dashed border-border-default py-12 text-center text-text-muted">
          <p className="text-sm">Awaiting evidence intake — the exhibit plan and drafted dossier will generate once the applicant completes their evidence profile.</p>
          {lead.caseId && (
            <Link href={`/cases/${lead.caseId}`} className="mt-3 inline-block text-sm underline text-text-muted">
              Open case to send intake link →
            </Link>
          )}
        </div>
      )}

      {/* Claim Details — attorney only, post-claim; hidden on lg: (right rail shows it) */}
      {!isAdmin && isClaimed && lead.caseId && claimedAt && (
        <div className="lg:hidden rounded-xl border border-border-default bg-surface-subtle px-6 py-5 space-y-3">
          <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Claim Details</h2>
          <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2 sm:gap-x-8 text-sm">
            <div>
              <dt className="text-xs text-text-muted">Claimed on</dt>
              <dd className="mt-0.5 text-text-secondary">
                {claimedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-text-muted">Refund window</dt>
              <dd className="mt-0.5 text-text-secondary">
                {refundWindowOpen
                  ? `Eligible until ${refundWindowEnd!.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
                  : "Closed"}
              </dd>
            </div>
          </dl>

          <p className="text-xs text-text-muted leading-relaxed">
            If the applicant doesn&apos;t complete intake within 14 days, your $150 is automatically refunded. No action needed.
          </p>

          {/* Refund status or request link */}
          {refundRequest ? (
            <div className="flex items-center gap-2 border-t border-border-default pt-3">
              <span className={`badge ${
                refundRequest.status === "pending" ? "badge-warning"
                : refundRequest.status === "refunded" ? "badge-success"
                : refundRequest.status === "denied" ? "badge-danger"
                : "badge-neutral"
              }`}>
                {refundRequest.status === "pending" ? "Refund pending"
                  : refundRequest.status === "refunded" ? "Refunded"
                  : refundRequest.status === "denied" ? "Refund denied"
                  : refundRequest.status}
              </span>
              <span className="text-xs text-text-muted">
                Requested {new Date(refundRequest.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>
          ) : (refundWindowOpen && hasPayment) ? (
            <div className="border-t border-border-default pt-3">
              <RefundRequestButton caseId={lead.caseId} />
            </div>
          ) : null}
        </div>
      )}

          <div className="flex justify-between text-xs text-text-muted">
            <span>Source: {lead.source}{lead.refCode ? ` · ref: ${lead.refCode}` : ""}</span>
            <Link href={isAdmin ? "/admin/leads" : "/network/leads"} className="underline hover:text-text-secondary">← All leads</Link>
          </div>

        </div>{/* end main column */}

        {/* ── Right rail — lg: only, sticky ── */}
        <div className="hidden lg:block">
          <div className="sticky top-6 space-y-4">

            {/* Claim card */}
            <div className="card space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`badge badge-${tierMeta.statusToken}`}>
                  {TIER_LABEL[tier] ?? tier}
                </span>
                {lead.trustScore != null && lead.trustScore > 0 && (
                  <span className={`text-xs font-semibold ${
                    lead.trustScore >= 80 ? "text-success-text"
                    : lead.trustScore >= 60 ? "text-warning-text"
                    : "text-danger-text"
                  }`}>
                    Trust {lead.trustScore}/100
                  </span>
                )}
              {/* Compact commercial signal dots */}
              {!isAdmin && (() => {
                const fd2 = lead.formData as Record<string, unknown> | null;
                const f2 = deriveCommercialFlags(fd2);
                const dotCls: Record<string, string> = {
                  green: "bg-success-text",
                  yellow: "bg-warning-text",
                  grey: "bg-text-muted",
                };
                return (
                  <div className="flex items-center gap-1.5 mt-1">
                    {[f2.usPlan, f2.selfPetitionFit, f2.nationalHook].map((f) => (
                      <span key={f.label} title={`${f.label}: ${f.value}`}
                        className={`h-2 w-2 rounded-full ${dotCls[f.color]}`}
                      />
                    ))}
                    <span className="text-xs text-text-muted">commercial signals</span>
                  </div>
                );
              })()}
              </div>

              {/* Pre-claim attorney CTA */}
              {!isAdmin && !isClaimed && session?.role === "attorney" && (
                <div className="space-y-2">
                  <span className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-default bg-surface-subtle px-3 py-1.5 text-sm text-text-muted cursor-not-allowed" aria-disabled="true">
                    <Lock className="h-3.5 w-3.5" />
                    Full 8-Page Dossier Locked
                  </span>
                  <ClaimButton leadId={lead.id} />
                  <p className="text-xs text-text-muted leading-relaxed">
                    If the applicant doesn&apos;t complete intake within 14 days, your $150 is automatically refunded. No paperwork.
                  </p>
                </div>
              )}

              {/* Post-claim attorney CTAs */}
              {!isAdmin && isClaimed && (
                <div className="space-y-2">
                  <a href={`/api/leads/${lead.id}/dossier`} target="_blank" rel="noreferrer" className="btn btn-primary text-sm w-full text-center">
                    View petition draft →
                  </a>
                  {lead.caseId && (
                    <>
                      <BriefDownloadButton leadId={lead.id} />
                      <Link href={`/cases/${lead.caseId}`} className="btn btn-secondary text-sm w-full text-center">
                        Open case workspace →
                      </Link>
                    </>
                  )}
                </div>
              )}

              {/* Admin CTAs */}
              {isAdmin && (
                <div className="space-y-2">
                  {!isClaimed && legacyTierToCanonical(lead.tier) !== "early" && lead.dossierStatus === "completed" && (
                    <NotifyButton leadId={lead.id} />
                  )}
                  {lead.dossierStatus === "failed" && lead.caseId && (
                    <RequeueDossierButton leadId={lead.id} />
                  )}
                  {isClaimed && (
                    <ReleaseButton leadId={lead.id} hasPayment={lead.claimPayment?.status === "completed"} />
                  )}
                </div>
              )}
            </div>

            {/* Claim details — post-claim attorney */}
            {!isAdmin && isClaimed && lead.caseId && claimedAt && (
              <div className="card space-y-3">
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Claim Details</h2>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-xs text-text-muted">Claimed on</dt>
                    <dd className="mt-0.5 text-text-secondary">
                      {claimedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-text-muted">Refund window</dt>
                    <dd className="mt-0.5 text-text-secondary">
                      {refundWindowOpen
                        ? `Until ${refundWindowEnd!.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                        : "Closed"}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-text-muted leading-relaxed">
                  14-day ghost auto-refund · 30-day misrepresentation refund.
                </p>
                {refundRequest ? (
                  <span className={`badge ${
                    refundRequest.status === "pending" ? "badge-warning"
                    : refundRequest.status === "refunded" ? "badge-success"
                    : refundRequest.status === "denied" ? "badge-danger"
                    : "badge-neutral"
                  }`}>
                    {refundRequest.status === "pending" ? "Refund pending"
                      : refundRequest.status === "refunded" ? "Refunded"
                      : refundRequest.status === "denied" ? "Refund denied"
                      : refundRequest.status}
                  </span>
                ) : (refundWindowOpen && hasPayment) ? (
                  <RefundRequestButton caseId={lead.caseId} />
                ) : null}
              </div>
            )}

          </div>
        </div>{/* end right rail */}

      </div>{/* end grid */}
    </div>
  );
}
