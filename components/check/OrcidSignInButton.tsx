"use client";

import { useState } from "react";

type Props = {
  leadId: string;
  /** If true, show a compact inline variant instead of the full card */
  compact?: boolean;
};

export function OrcidSignInButton({ leadId, compact }: Props) {
  const [clicked, setClicked] = useState(false);

  const href = `/api/auth/orcid?leadId=${leadId}`;

  if (compact) {
    return (
      <a
        href={href}
        onClick={() => setClicked(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#a6ce39] bg-surface-card px-4 py-2 text-sm font-medium text-[#a6ce39] hover:bg-[#a6ce39]/10 transition-colors"
      >
        <OrcidLogo className="h-4 w-4" />
        {clicked ? "Opening ORCID…" : "Sign in with ORCID"}
      </a>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#a6ce39]/40 bg-[#a6ce39]/5 px-6 py-5 space-y-3">
      <div className="flex items-start gap-3">
        <OrcidLogo className="h-7 w-7 text-[#a6ce39] shrink-0 mt-0.5" />
        <div>
          {/* NEEDS FOUNDER REVIEW — positioning copy */}
          <p className="text-sm font-semibold text-text-primary">Confirm your identity with ORCID</p>
          <p className="mt-1 text-sm text-text-secondary leading-relaxed">
            Sign in once with your ORCID account to upgrade your badge from{" "}
            <strong>&ldquo;Publicly corroborated&rdquo;</strong> to{" "}
            <strong>&ldquo;Identity confirmed&rdquo;</strong> — the highest tier attorneys see.
            Attorneys request confirmed leads first.
          </p>
        </div>
      </div>
      <a
        href={href}
        onClick={() => setClicked(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-[#a6ce39] bg-surface-card px-4 py-2.5 text-sm font-semibold text-[#a6ce39] hover:bg-[#a6ce39]/10 transition-colors"
      >
        <OrcidLogo className="h-5 w-5" />
        {clicked ? "Opening ORCID…" : "Sign in with ORCID iD →"}
      </a>
      <p className="text-xs text-text-muted">
        ORCID public OAuth — we receive only your verified iD, nothing else. Takes 30 seconds.
      </p>
    </div>
  );
}

/**
 * Persistent confirmed state — shown in place of the CTA once ORCID OAuth has
 * completed. Applicants previously got no visible confirmation at all (the CTA
 * just disappeared), which buried the one identity signal we most want them to
 * see succeed.
 */
export function OrcidConfirmedCard({ orcidId }: { orcidId?: string | null }) {
  return (
    <div className="rounded-xl border-2 border-success-border bg-success-bg px-6 py-4 flex items-start gap-3">
      <OrcidLogo className="h-6 w-6 text-[#a6ce39] shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-success-text">Identity confirmed via ORCID</p>
        <p className="mt-0.5 text-sm text-text-secondary leading-relaxed">
          {orcidId ? (
            <>iD <span className="font-mono">{orcidId}</span> is verified and attached to your profile.{" "}</>
          ) : null}
          Attorneys see <strong>&ldquo;Identity confirmed&rdquo;</strong> — the highest trust badge — on your profile.
        </p>
      </div>
    </div>
  );
}

/**
 * Slim one-row CTA for the in-wizard result view, where the full card would
 * compete with the consent checkbox (the funnel's primary action). Same claim
 * language as the full card.
 */
export function OrcidInlineCta({ leadId }: { leadId: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <p className="text-sm text-text-secondary flex-1 leading-relaxed">
        <strong className="text-text-primary">Attorneys request identity-confirmed leads first.</strong>{" "}
        Sign in once with ORCID to upgrade your badge to &ldquo;Identity confirmed&rdquo;.
      </p>
      <OrcidSignInButton leadId={leadId} compact />
    </div>
  );
}

function OrcidLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" fill="currentColor" aria-hidden>
      <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zM86.3 186.2H70.9V79.1h15.4v107.1zm-7.7-119.1c-4.9 0-8.9-4-8.9-8.9s4-8.9 8.9-8.9 8.9 4 8.9 8.9-4 8.9-8.9 8.9zM182.6 186.2h-15.4v-55.9c0-13.2-5-21.4-17.3-21.4-10 0-16.2 6.7-18.9 13.2-.9 2.3-1.2 5.5-1.2 8.7v55.5h-15.4V124c0-7.6-.2-14-.6-19.3h13.4l.7 11.8h.5c4.1-6.7 11.4-13.4 24.2-13.4 16.5 0 28.9 10.8 28.9 33.9v49.2z"/>
    </svg>
  );
}
