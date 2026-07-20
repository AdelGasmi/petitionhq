import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReferralCopyButton } from "./ReferralCopyButton";
import { ConsentCard } from "./ConsentCard";
import { logActivity } from "@/lib/activity";
import { legacyTierToCanonical } from "@/lib/scoring";
import { TierHero } from "@/components/TierHero";
import { VerificationTeaser } from "@/components/check/VerificationTeaser";
import { VerificationBadges } from "@/components/check/VerificationBadges";
import { OrcidSignInButton, OrcidConfirmedCard } from "@/components/check/OrcidSignInButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Personal assessment data — must never be indexed, even if a link leaks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ orcid?: string }>;
};

export default async function CheckResultPage({ params, searchParams }: Props) {
  const { leadId } = await params;
  const { orcid: orcidStatus } = await searchParams;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      tier: true,
      score: true,
      trustScore: true,
      formData: true,
      verifiedClaims: true,
      applicantStatus: true,
      maturity: true,
      orcidAuthenticated: true,
      orcidVerifiedId: true,
      resultToken: true,
    },
  });

  if (!lead) notFound();

  // Funnel metric: every result page render counts as a view
  logActivity({ action: "lead.result_viewed", detail: lead.id });

  const tier = lead.tier ?? "tier3";
  const score = lead.score ?? 0;
  const field = (() => {
    const fd = lead.formData as Record<string, unknown> | null;
    return fd ? String(fd.field ?? "Research") : "Research";
  })();

  const canonicalTier = legacyTierToCanonical(tier);
  const isStrong = canonicalTier === "strong";

  const fd = lead.formData as Record<string, unknown> | null;
  const dims = Array.isArray(fd?._dimensions)
    ? (fd!._dimensions as { label: string; score: number; notes?: string }[])
    : [];
  const gap = fd?._gapNarrative as
    | { strengths?: string; blockers?: string; legalLeverage?: string }
    | undefined;

  return (
    <div className="mx-auto max-w-2xl py-10 space-y-8">
      <div className="text-center mb-2">
        <h1 className="font-serif text-3xl tracking-tight">Your NIW Assessment</h1>
        <p className="mt-1 text-sm text-text-secondary">Based on your self-reported profile</p>
      </div>

      <TierHero
        tier={canonicalTier}
        score={score}
        pathLabel="EB-2 NIW"
        summary={
          isStrong
            ? `Your profile in ${field} is strong. You have the credentials to support a well-structured NIW petition.`
            : canonicalTier === "developing"
            ? `Your ${field} profile shows real promise. With the right legal strategy, a few targeted improvements could significantly strengthen your case.`
            : `Your ${field} profile has potential, but needs strategic development before filing. The right attorney can help structure your case.`
        }
      />

      {/* ORCID callback feedback — the OAuth round-trip lands back here. */}
      {orcidStatus === "verified" && (
        <div className="rounded-xl border border-success-border bg-success-bg px-5 py-3 text-sm font-medium text-success-text">
          ORCID sign-in complete — your identity is confirmed. We&apos;re re-running
          verification with your confirmed iD now; your trust profile updates shortly.
        </div>
      )}
      {orcidStatus && orcidStatus !== "verified" && (
        <div className="rounded-xl border border-warning-border bg-warning-bg px-5 py-3 text-sm font-medium text-warning-text">
          ORCID sign-in didn&apos;t complete. You can try again below — it takes about 30 seconds.
        </div>
      )}

      {/* TRU-2: ORCID identity-confirm CTA — above the fold, shown to every
          non-OAuth lead. This is the one reliable disambiguator for common
          names, so it must never be hidden behind a build-time env check.
          Once OAuth has completed, a persistent confirmed card replaces it. */}
      {lead.orcidAuthenticated ? (
        <OrcidConfirmedCard orcidId={lead.orcidVerifiedId} />
      ) : (
        <OrcidSignInButton leadId={lead.id} />
      )}

      {/* The honest one-line read — the product, front and center */}
      {gap?.blockers && (
        <div className="rounded-xl border-2 border-warning-border bg-warning-bg px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-warning-text mb-1">The honest read</p>
          <p className="text-base font-medium text-warning-text leading-relaxed">{gap.blockers}</p>
        </div>
      )}

      {/* Dimensions breakdown */}
      {dims.length > 0 && (
        <div className="card space-y-4">
          <h3 className="font-serif text-lg">Assessment Breakdown</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {dims.map((d) => (
              <div key={d.label} className="rounded-lg bg-surface-subtle px-3 py-3">
                <div className="text-xs text-text-muted uppercase tracking-wider">{d.label}</div>
                <div className="mt-0.5 text-lg font-bold text-text-primary">{d.score}<span className="text-xs font-normal text-text-muted">/100</span></div>
                <div className="progress mt-1.5">
                  <div className="progress-fill" style={{ width: `${Math.min(d.score, 100)}%` }} />
                </div>
                {d.notes && <p className="mt-1.5 text-xs text-text-secondary leading-snug">{d.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gap narrative */}
      {gap && (gap.strengths || gap.blockers || gap.legalLeverage) && (
        <div className="rounded-xl border border-border-default bg-surface-card px-6 py-6 space-y-4">
          <h3 className="font-serif text-lg">Your Case Profile</h3>
          <div className="space-y-3">
            {gap.strengths && (
              <div className="rounded-lg bg-success-bg border border-success-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-success-text mb-1">Strengths</p>
                <p className="text-sm text-success-text leading-relaxed">{gap.strengths}</p>
              </div>
            )}
            {gap.blockers && (
              <div className="rounded-lg bg-warning-bg border border-warning-border px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-warning-text mb-1">Areas to Address</p>
                <p className="text-sm text-warning-text leading-relaxed">{gap.blockers}</p>
              </div>
            )}
            {gap.legalLeverage && (
              <div className="rounded-lg bg-surface-canvas border border-border-default px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">How stronger cases fix this</p>
                <p className="text-sm text-text-secondary leading-relaxed">{gap.legalLeverage}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification — if already consented and verified, show full breakdown; else teaser */}
      {(() => {
        const vc = lead.verifiedClaims as Record<string, unknown> | null;
        const preliminary = vc?.preliminary as {
          found?: boolean;
          worksCount?: number;
          citedByCount?: number;
          institution?: string;
          matchConfidence?: number;
        } | undefined;

        const isConsented = lead.applicantStatus === "approved";
        const trustScore = lead.trustScore ?? 0;

        // Already consented + have full verification results → show breakdown
        if (isConsented && vc && Object.keys(vc).some(k => k !== "preliminary")) {
          return (
            <div className="rounded-xl border border-border-default bg-surface-card px-6 py-6">
              <VerificationBadges
                trustScore={trustScore}
                verifiedClaims={vc as Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }>}
                leadId={lead.id}
                orcidAuthenticated={lead.orcidAuthenticated ?? false}
              />
            </div>
          );
        }

        // Pre-consent: show quickPing teaser if available
        if (preliminary?.found) {
          return (
            <VerificationTeaser
              worksCount={preliminary.worksCount}
              citedByCount={preliminary.citedByCount}
              institution={preliminary.institution}
              matchConfidence={preliminary.matchConfidence}
            />
          );
        }
        return null;
      })()}

      {/* Consent card — placed directly below gap narrative for maximum intent capture */}
      <ConsentCard leadId={lead.id} resultToken={lead.resultToken ?? ""} initialStatus={lead.applicantStatus} formData={fd} />

      {/* Share — viral loop, every tier (the roast shares as well as the flex) */}
      <div className="card space-y-2">
        <p className="text-sm font-medium text-text-primary">
          {isStrong
            ? "You've got a real case. Know someone who missed the H-1B lottery?"
            : "Most people have no idea where their NIW case actually stands."}
        </p>
        <p className="text-sm text-text-secondary">
          {isStrong
            ? "Share your link — they get the same free, honest read, and you get $50 off your filing fee if you retain an attorney."
            : "Send a friend their own honest gap-check. Better to hear it here than from a $15,000 denial 6 months later."}
        </p>
        <ReferralCopyButton url={`${process.env.NEXT_PUBLIC_BASE_URL ?? "https://petitionhq.us"}/check?ref=${lead.id}`} />
      </div>

      <p className="text-center text-xs text-text-muted">
        This assessment is for informational purposes only and does not constitute legal advice.
        Attorney matching is provided through our network of licensed immigration attorneys.
      </p>
    </div>
  );
}
