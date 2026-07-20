"use client";

import { useState, useCallback } from "react";
import { VerificationLoader } from "@/components/check/VerificationLoader";
import { VerificationBadges } from "@/components/check/VerificationBadges";
import { ChevronRight, Eye, CheckCircle } from "@/components/icons";

type FormData = Record<string, unknown>;

type Dimension = { label: string; score: number; notes?: string };
type GapNarrative = { strengths?: string; blockers?: string; legalLeverage?: string };

type VerificationResult = {
  trustScore: number;
  verifiedClaims: Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }>;
};

export function ConsentCard({
  leadId,
  resultToken,
  initialStatus,
  formData,
}: {
  leadId: string;
  resultToken: string;
  initialStatus: string;
  formData?: FormData | null;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "verifying" | "success">(
    initialStatus === "approved" ? "success" : "idle"
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const handleConsent = async () => {
    setStatus("loading");
    // Record consent FIRST — it sets applicantStatus=approved (and maturity
    // M2→M3), which the verification that follows requires to promote the lead
    // to M7. Firing both in parallel raced: /verify often read applicantStatus
    // before consent had committed, leaving a consented lead stuck below M7.
    try {
      await fetch(`/api/leads/${leadId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultToken }),
      });
    } catch {
      /* best-effort — verification still runs; the M7 gate re-checks on reverify */
    }
    setStatus("verifying");
  };

  const handleVerificationComplete = useCallback((result: { trustScore: number; verifiedClaims: Record<string, unknown> }) => {
    setVerificationResult(result as VerificationResult);
    setStatus("success");
  }, []);

  const handleVerificationTimeout = useCallback(() => {
    // Proceed to success even on timeout — verification continues in background
    setStatus("success");
  }, []);

  if (status === "verifying") {
    return (
      <VerificationLoader
        leadId={leadId}
        resultToken={resultToken}
        onComplete={handleVerificationComplete}
        onTimeout={handleVerificationTimeout}
      />
    );
  }

  if (status === "success") {
    return (
      <div className="space-y-4">
        {/* Verification badges — show when we have results from the loader */}
        {verificationResult && Object.keys(verificationResult.verifiedClaims).length > 0 && (
          <div className="rounded-xl border border-border-default bg-surface-card px-6 py-6">
            <VerificationBadges
              trustScore={verificationResult.trustScore}
              verifiedClaims={verificationResult.verifiedClaims}
            />
          </div>
        )}

        <div className="rounded-xl border border-success-border bg-success-bg px-6 py-6 space-y-1">
          <h3 className="text-base font-semibold text-success-text">Profile Shared Successfully</h3>
          <p className="mt-1 text-sm text-success-text leading-relaxed">
            Your assessment is now visible to our vetted attorney network. We&apos;re onboarding firms
            now — if one wants to take your case, we&apos;ll email you with next steps. No contact unless
            a firm opts in. You can close this page.
          </p>
        </div>
      </div>
    );
  }

  // Build the preview data from formData
  const fd = formData ?? {};
  const profileItems = [
    { label: "Field", value: fd.field },
    { label: "Degree", value: fd.degree },
    { label: "Experience", value: fd.yearsExperience ? `${fd.yearsExperience} years` : null },
    { label: "Publications", value: fd.publications },
    { label: "Citations", value: fd.citations },
    { label: "Patents", value: fd.patents },
    { label: "Awards", value: fd.awards },
    { label: "Grants", value: fd.grants },
    { label: "Peer review / editorial roles", value: fd.peerReview },
    { label: "Invited talks", value: fd.invitedTalks },
  ].filter((item) => item.value != null && item.value !== "" && item.value !== "0" && item.value !== 0);

  const dims = Array.isArray(fd._dimensions) ? (fd._dimensions as Dimension[]) : [];
  const gap = fd._gapNarrative as GapNarrative | undefined;
  const summary = fd._summary as string | undefined;

  return (
    <div className="rounded-xl border border-border-default bg-surface-card px-6 py-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-base font-semibold text-text-primary">Free Attorney Evaluation Available</h3>
        <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">
          Your AI assessment is complete. We can securely share your profile with our network of
          vetted EB-2 NIW attorneys to see if they will take your case.
        </p>
      </div>

      {/* Preview toggle */}
      <button
        type="button"
        onClick={() => setPreviewOpen((v) => !v)}
        className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
      >
        <ChevronRight className={`h-4 w-4 transition-transform ${previewOpen ? "rotate-90" : ""}`} />
        {previewOpen ? "Hide preview" : "See exactly what attorneys will see"}
      </button>

      {/* Preview panel */}
      {previewOpen && (
        <div className="rounded-lg border border-border-subtle bg-surface-subtle px-5 py-5 space-y-5">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-text-muted" />
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Attorney view preview
            </span>
          </div>

          {/* Profile data */}
          {profileItems.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Profile data shared
              </h4>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {profileItems.map((item) => (
                  <div key={item.label} className="flex justify-between text-sm">
                    <span className="text-text-muted">{item.label}</span>
                    <span className="font-medium text-text-primary">{String(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Assessment summary */}
          {summary && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                AI legal assessment
              </h4>
              <p className="text-sm text-text-secondary leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Dimension scores */}
          {dims.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Dimension scores
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {dims.map((d) => (
                  <div key={d.label} className="rounded-md bg-surface-card px-3 py-2">
                    <div className="text-xs text-text-muted">{d.label}</div>
                    <div className="text-sm font-bold text-text-primary">{d.score}/100</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gap narrative */}
          {gap && (gap.strengths || gap.blockers) && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">
                Case strengths &amp; gaps
              </h4>
              <div className="space-y-2 text-sm">
                {gap.strengths && (
                  <p className="text-text-secondary"><span className="font-medium text-success-text">Strengths:</span> {gap.strengths}</p>
                )}
                {gap.blockers && (
                  <p className="text-text-secondary"><span className="font-medium text-warning-text">To address:</span> {gap.blockers}</p>
                )}
              </div>
            </div>
          )}

          {/* Verification disclosure */}
          <div className="border-t border-border-subtle pt-3">
            <div className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-success-fill mt-0.5 shrink-0" />
              <p className="text-xs text-text-secondary leading-relaxed">
                If we can match your public record, attorneys also see a verification report
                confirming your publications, institution, and grants via public databases.
              </p>
            </div>
          </div>

          {/* What is NOT shared */}
          <div className="border-t border-border-subtle pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
              Not shared with attorneys
            </h4>
            <ul className="text-xs text-text-muted space-y-0.5">
              <li>Your name and email (kept private until you approve a match)</li>
              <li>Your employer details</li>
              <li>Your phone number or address</li>
            </ul>
          </div>
        </div>
      )}

      {/* Consent button */}
      <div>
        <button
          onClick={handleConsent}
          disabled={status === "loading"}
          data-loading={status === "loading"}
          className="btn btn-primary w-full sm:w-auto"
        >
          {status === "loading" ? "Securing Match..." : "Request Attorney Match"}
        </button>
        <p className="mt-2.5 text-xs text-text-muted leading-relaxed">
          By requesting a match, you consent to share your profile data with PetitionHQ&apos;s
          legal network. You will only be contacted if a firm accepts your case.
        </p>
      </div>
    </div>
  );
}
