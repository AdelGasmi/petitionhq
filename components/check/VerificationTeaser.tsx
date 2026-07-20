"use client";

import { ShieldCheck } from "@/components/icons";

type Props = {
  worksCount?: number;
  citedByCount?: number;
  institution?: string;
  matchConfidence?: number;
  onContinue?: () => void;
};

/**
 * Teaser card shown on the score-reveal page when quickPing found a
 * public research profile matching the applicant's answers.
 *
 * Only rendered when preliminary.found === true.
 * If found === false, the parent page does NOT render this component
 * (we do not show "we couldn't find you" — many early-career applicants
 * won't have a public profile yet).
 */
export function VerificationTeaser({
  worksCount,
  citedByCount,
  institution,
  matchConfidence,
  onContinue,
}: Props) {
  return (
    <div className="rounded-xl border border-verify-border bg-gradient-to-br from-verify-bg to-surface-card px-6 py-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-verify-soft">
          <ShieldCheck className="h-4 w-4 text-verify-fill" />
        </div>
        <h3 className="font-serif text-lg text-text-primary">
          We found a public research profile matching your answers
        </h3>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-4">
        {worksCount !== undefined && worksCount > 0 && (
          <div className="rounded-lg bg-surface-card border border-verify-soft px-4 py-2">
            <div className="text-xs text-text-muted uppercase tracking-wider">Publications</div>
            <div className="text-lg font-bold text-text-primary tabular-nums">{worksCount.toLocaleString()}</div>
          </div>
        )}
        {citedByCount !== undefined && citedByCount > 0 && (
          <div className="rounded-lg bg-surface-card border border-verify-soft px-4 py-2">
            <div className="text-xs text-text-muted uppercase tracking-wider">Citations</div>
            <div className="text-lg font-bold text-text-primary tabular-nums">{citedByCount.toLocaleString()}</div>
          </div>
        )}
        {institution && (
          <div className="rounded-lg bg-surface-card border border-verify-soft px-4 py-2">
            <div className="text-xs text-text-muted uppercase tracking-wider">Institution</div>
            <div className="text-sm font-medium text-text-primary">{institution}</div>
          </div>
        )}
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">
        Complete the full assessment to verify these credentials and unlock attorney matching
        with your verified profile.
      </p>

      {onContinue && (
        <button
          onClick={onContinue}
          className="btn btn-primary text-sm"
        >
          Continue
        </button>
      )}
    </div>
  );
}
