"use client";

import { CheckCircle, AlertTriangle, ExternalLink } from "@/components/icons";
import { OrcidSignInButton } from "@/components/check/OrcidSignInButton";

type ClaimResult = {
  status: string;
  source: string;
  sourceUrl?: string;
  confidence: number;
  detail?: string;
};

type Props = {
  trustScore: number;
  verifiedClaims: Record<string, ClaimResult>;
  /** Enables the inline "confirm identity with ORCID" remedy below a sub-gate score. */
  leadId?: string;
  orcidAuthenticated?: boolean;
};

const CLAIM_LABELS: Record<string, string> = {
  researcher_profile: "Research profile",
  publications: "Publications",
  orcid: "ORCID",
  institution: "Institution",
  nsf_grants: "NSF grants",
  nih_grants: "NIH grants",
  patents: "Patents",
  awards: "Awards",
  peerReview: "Peer review roles",
  invitedTalks: "Invited talks",
};

type Breakdown = {
  identity: number; identityCap: number;
  substance: number; substanceCap: number;
  consistency: number; consistencyCap: number;
  institution: number; institutionCap: number;
};

function ScoreBar({ label, value, cap, note }: { label: string; value: number; cap: number; note?: string }) {
  const pct = Math.max(0, Math.min(100, (value / cap) * 100));
  const low = value < cap * 0.5;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-text-secondary">{label}</span>
        <span className={`font-medium tabular-nums ${low ? "text-warning-text" : "text-success-text"}`}>
          {value}&thinsp;/&thinsp;{cap}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${low ? "bg-warning-fill" : "bg-success-fill"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {note && <p className="text-xs text-text-muted leading-snug">{note}</p>}
    </div>
  );
}

function remediationTips(
  trustScore: number,
  claims: Record<string, ClaimResult>,
  breakdown: Breakdown | null,
): { title: string; body: string }[] {
  const tips: { title: string; body: string }[] = [];
  const hasOrcid = !!claims.orcid && claims.orcid.status === "verified";
  const profileAmbiguous = claims.researcher_profile?.status === "ambiguous";
  const noProfile = !claims.researcher_profile || claims.researcher_profile.status === "not_found";
  const identityFloor = breakdown?.identity ?? 0;
  const gap = 60 - trustScore;

  if (identityFloor <= 35 && (profileAmbiguous || noProfile) && !hasOrcid) {
    tips.push({
      title: "Add your ORCID iD",
      body:
        noProfile
          ? "We couldn't uniquely match your public record. Submitting your ORCID iD (orcid.org — free) lets us fetch your profile directly instead of searching by name, which resolves most identity-ambiguity issues."
          : "Your name matched more than one researcher in our databases. An ORCID iD lets us fetch your exact record and add a second corroborating source, which raises the identity floor from 35 to 45.",
    });
  }

  if (!hasOrcid && identityFloor >= 35 && gap <= 10) {
    tips.push({
      title: "You're close — ORCID iD could close the gap",
      body: `You need ${gap} more point${gap === 1 ? "" : "s"} to reach attorney visibility. Adding your ORCID iD typically adds a second corroborating source (floor 45 vs 35) and unlocks citation metrics — that alone is usually enough.`,
    });
  }

  if (breakdown && breakdown.substance === 0 && breakdown.identity > 35) {
    tips.push({
      title: "Publication metrics couldn't be read",
      body:
        "Your identity was confirmed but our databases returned limited citation data — common for researchers whose work is under a name variant or not yet fully indexed. This may resolve when OpenAlex next re-indexes your institution's recent works.",
    });
  }

  if (breakdown && breakdown.consistency < 0) {
    tips.push({
      title: "Check your claimed numbers",
      body:
        "Our databases found significantly fewer publications than you reported. This is sometimes indexing lag, but double-check your intake numbers — the discrepancy is holding your score down.",
    });
  }

  return tips;
}

/**
 * Shows verification badges for each verified claim, plus a score breakdown
 * and actionable remediation tips when the trust score is below the M7 gate (60).
 */
export function VerificationBadges({ trustScore, verifiedClaims, leadId, orcidAuthenticated }: Props) {
  const entries = Object.entries(verifiedClaims)
    .filter(([key]) => key !== "preliminary" && key !== "_breakdown" && key !== "_aggregate")
    .sort(([, a], [, b]) => {
      const order: Record<string, number> = { verified: 0, self_reported: 1, not_found: 2, contradicted: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

  const breakdown: Breakdown | null = (() => {
    try {
      const raw = verifiedClaims._breakdown?.detail;
      return raw ? (JSON.parse(raw) as Breakdown) : null;
    } catch { return null; }
  })();

  const hasVerified = entries.some(([, c]) => c.status === "verified");
  const belowGate = trustScore < 60;
  const tips = belowGate ? remediationTips(trustScore, verifiedClaims, breakdown) : [];

  return (
    <div className="space-y-5">
      <h3 className="font-serif text-lg text-text-primary">
        {hasVerified
          ? /* NEEDS FOUNDER REVIEW */ "Your publicly corroborated profile is ready to share with attorneys"
          : "We couldn't independently match your public record yet"}
      </h3>

      {/* Trust score meter with 60-point gate marker */}
      {(hasVerified || trustScore > 0) && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-text-primary">Trust score</span>
            <span className={`text-xl font-bold tabular-nums ${
              trustScore >= 60 ? "text-success-text" :
              trustScore > 0 ? "text-warning-text" :
              "text-text-muted"
            }`}>
              {trustScore}<span className="text-sm font-normal text-text-muted">&thinsp;/&thinsp;100</span>
            </span>
          </div>

          {/* Track with 60-gate marker */}
          <div className="relative h-2 rounded-full bg-surface-subtle overflow-visible">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                trustScore >= 60 ? "bg-success-fill" : "bg-warning-fill"
              }`}
              style={{ width: `${Math.min(trustScore, 100)}%` }}
            />
            {/* 60-point gate tick */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-text-primary opacity-40"
              style={{ left: "60%" }}
            />
          </div>

          <div className="flex justify-between text-xs text-text-muted">
            <span>0</span>
            <span
              className="absolute"
              style={{ left: "calc(60% - 0.5rem)", position: "relative", transform: "translateX(-50%)" }}
            >
              60 — attorney threshold
            </span>
            <span>100</span>
          </div>

          {belowGate && (
            <p className="text-xs text-warning-text">
              A common name can make your public record hard to match automatically — this reflects how confidently we could
              <em> confirm it&rsquo;s you</em>, not the strength of your case. The fastest fix is below.
            </p>
          )}
          {belowGate && leadId && !orcidAuthenticated && (
            <div className="pt-1">
              <OrcidSignInButton leadId={leadId} compact />
            </div>
          )}
          {!belowGate && (
            <p className="text-xs text-success-text">
              Your score clears the attorney-visibility threshold. Your profile is active in the attorney network.
            </p>
          )}
        </div>
      )}

      {/* Component breakdown bars — shown when _breakdown is available */}
      {breakdown && (
        <div className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Score breakdown</p>
          <ScoreBar
            label="Identity corroboration"
            value={breakdown.identity}
            cap={breakdown.identityCap}
            note={
              breakdown.identity <= 35
                ? "Only one database independently confirmed your identity — a second source raises this floor."
                : breakdown.identity >= 55
                ? "Three or more independent sources corroborated your identity."
                : undefined
            }
          />
          <ScoreBar label="Publication substance" value={breakdown.substance} cap={breakdown.substanceCap} />
          <ScoreBar label="Claim consistency" value={Math.max(0, breakdown.consistency)} cap={breakdown.consistencyCap} />
          <ScoreBar label="Institution" value={breakdown.institution} cap={breakdown.institutionCap} />
        </div>
      )}

      {/* Remediation tips — shown only when score < 60 */}
      {tips.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-text-primary">How to improve your score</p>
          {tips.map((tip, i) => (
            <div key={i} className="rounded-lg border border-border-default bg-surface-card px-4 py-3 space-y-1">
              <p className="text-sm font-medium text-text-primary">{tip.title}</p>
              <p className="text-sm text-text-secondary leading-relaxed">{tip.body}</p>
            </div>
          ))}
          <p className="text-xs text-text-muted">
            Re-run the check after updating your profile —{" "}
            <a href="/check" className="underline hover:text-text-primary">start a new check →</a>

          </p>
        </div>
      )}

      {!hasVerified && (
        <p className="text-sm text-text-secondary leading-relaxed">
          This is common when your work is split across databases or listed under a name
          variant — it does <strong>not</strong> mean your case is weak. Re-run the check with
          your ORCID iD for an identity-confirmed version.
        </p>
      )}

      {/* Individual claim badges */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Corroboration details</p>
          {entries.map(([key, claim], idx) => {
            const isVerified = claim.status === "verified";
            const isSelfReported = claim.status === "self_reported";
            const isNotFound = claim.status === "not_found";

            if (isNotFound) return null;

            const label = CLAIM_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

            const content = (
              <div
                className={`flex items-start gap-3 rounded-lg px-4 py-3 ${
                  isVerified
                    ? "bg-success-bg border border-success-border"
                    : isSelfReported
                    ? "bg-warning-bg border border-warning-border"
                    : "bg-surface-subtle border border-border-default"
                }`}
              >
                {isVerified ? (
                  <CheckCircle className="h-5 w-5 text-success-fill mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-warning-fill mt-0.5 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isVerified ? "text-success-text" : "text-warning-text"}`}>
                      {label}
                    </span>
                    {isSelfReported && (
                      <span className="text-xs text-warning-text font-normal">(self-reported)</span>
                    )}
                  </div>
                  {claim.detail && (
                    <p className={`text-xs mt-0.5 ${isVerified ? "text-success-text" : "text-warning-text"}`}>
                      {claim.detail}
                    </p>
                  )}
                </div>

                {claim.sourceUrl && isVerified && (
                  <ExternalLink className="h-4 w-4 text-success-fill mt-0.5 shrink-0" />
                )}
              </div>
            );

            if (claim.sourceUrl && isVerified) {
              return (
                <a
                  key={key}
                  href={claim.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="verify-badge block hover:opacity-90 transition-opacity"
                  style={{ animationDelay: `${idx * 60}ms` }}
                >
                  {content}
                </a>
              );
            }

            return <div key={key} className="verify-badge" style={{ animationDelay: `${idx * 60}ms` }}>{content}</div>;
          })}
        </div>
      )}
    </div>
  );
}
