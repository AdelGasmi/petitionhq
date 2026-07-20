"use client";

import { useState } from "react";
import { LEVEL_LABEL, type VerificationLevel } from "@/lib/verification/level";

// ─── Types ─────────────────────────────────────────────────────────

type ClaimResult = {
  status: string;
  source: string;
  sourceUrl?: string;
  confidence: number;
  detail?: string;
  verifiedAt?: string;
};

type VerificationEvent = {
  id: string;
  source: string;
  action: string;
  result: string;
  claimKey?: string | null;
  evidenceRef?: string | null;
  confidenceScore?: number | null;
  createdAt: string;
};

type Props = {
  leadId: string;
  trustScore: number;
  verifiedClaims: Record<string, ClaimResult> | null;
  events: VerificationEvent[];
  lastVerifiedAt: string | null;
  maturity: string;
  adminAttested?: boolean;
  adminAttestedBy?: string | null;
  adminAttestedAt?: string | null;
  adminAttestedReason?: string | null;
};

// ─── Status UI mapping ─────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  verified: { label: "Corroborated", badgeClass: "badge badge-success", icon: "V" },
  self_reported: { label: "Self-reported", badgeClass: "badge badge-neutral", icon: "~" },
  not_found: { label: "Not found", badgeClass: "badge badge-warning", icon: "?" },
  contradicted: { label: "Contradicted", badgeClass: "badge badge-danger", icon: "!" },
  inconclusive: { label: "Inconclusive", badgeClass: "badge badge-neutral", icon: "-" },
};

const RESULT_BADGE: Record<string, string> = {
  verified: "text-success-text bg-success-bg",
  not_found: "text-warning-text bg-warning-bg",
  contradicted: "text-danger-text bg-danger-bg",
  inconclusive: "text-text-secondary bg-surface-subtle",
};

// Sort the claims table into honest groups: counted first, then excluded /
// uncertain, then self-reported, then not-found.
const STATUS_ORDER: Record<string, number> = {
  verified: 0, ambiguous: 1, inconclusive: 1, contradicted: 2, self_reported: 3, not_found: 4,
};

type Breakdown = {
  identity: number; identityCap: number;
  substance: number; substanceCap: number;
  consistency: number; consistencyCap: number;
  institution: number; institutionCap: number;
};

function parseBreakdown(claims: Record<string, ClaimResult>): Breakdown | null {
  const raw = claims["_breakdown"]?.detail;
  if (!raw) return null;
  try { return JSON.parse(raw) as Breakdown; } catch { return null; }
}

function BreakdownBar({ label, value, cap }: { label: string; value: number; cap: number }) {
  const pct = Math.max(0, Math.min(100, (value / cap) * 100));
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28 shrink-0 text-text-muted">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-subtle overflow-hidden">
        <div className={`h-full rounded-full ${value < 0 ? "bg-danger-fill" : "bg-info-fill"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right tabular-nums text-text-secondary">{value}/{cap}</span>
    </div>
  );
}

// ─── Component ─────────────────────────────────────────────────────

export function VerificationPanel({
  leadId,
  trustScore,
  verifiedClaims,
  events,
  lastVerifiedAt,
  maturity,
  adminAttested: initialAdminAttested = false,
  adminAttestedBy: initialAttestedBy = null,
  adminAttestedAt: initialAttestedAt = null,
  adminAttestedReason: initialAttestedReason = null,
}: Props) {
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [reverifying, setReverifying] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [currentScore, setCurrentScore] = useState(trustScore);
  const [currentClaims, setCurrentClaims] = useState(verifiedClaims);
  const [lastVerified, setLastVerified] = useState(lastVerifiedAt);
  const [currentMaturity, setCurrentMaturity] = useState(maturity);
  const [adminAttested, setAdminAttested] = useState(initialAdminAttested);
  const [attestedBy, setAttestedBy] = useState(initialAttestedBy);
  const [attestedAt, setAttestedAt] = useState(initialAttestedAt);
  const [attestedReason, setAttestedReason] = useState(initialAttestedReason);
  const [showAttestForm, setShowAttestForm] = useState(false);
  const [attestReason, setAttestReason] = useState("");
  const [attesting, setAttesting] = useState(false);

  const claims = currentClaims ?? {};
  // Exclude internal bookkeeping keys (_breakdown/_aggregate/_verificationLevel)
  // — they're now rendered as the verdict + bars, not as raw table rows.
  const claimEntries = Object.entries(claims)
    .filter(([key]) => key !== "preliminary" && !key.startsWith("_"))
    .sort(([, a], [, b]) => (STATUS_ORDER[a.status] ?? 5) - (STATUS_ORDER[b.status] ?? 5));
  const breakdown = parseBreakdown(claims);
  const level = (claims["_verificationLevel"]?.detail ?? null) as VerificationLevel | null;
  const aggregate = claims["_aggregate"]?.detail ?? null;
  const countedCount = claimEntries.filter(([, c]) => c.status === "verified").length;
  const excludedCount = claimEntries.filter(([, c]) => c.status === "ambiguous" || c.status === "inconclusive").length;

  async function handleAttest() {
    if (!attestReason.trim()) return;
    setAttesting(true);
    setToast(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}/attest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: attestReason.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setToast({ message: data.error ?? "Attestation failed", type: "error" });
        return;
      }

      setCurrentScore(data.trustScore);
      setCurrentMaturity(data.maturity);
      setAdminAttested(true);
      setAttestedBy("you");
      setAttestedAt(new Date().toISOString());
      setAttestedReason(attestReason.trim());
      setShowAttestForm(false);
      setAttestReason("");
      setToast({ message: `Identity attested — trust ${data.trustScore}/100, stage ${data.maturity}`, type: "success" });
    } catch {
      setToast({ message: "Network error during attestation", type: "error" });
    } finally {
      setAttesting(false);
    }
  }

  async function handleReverify() {
    setReverifying(true);
    setToast(null);

    try {
      const res = await fetch(`/api/admin/leads/${leadId}/reverify`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setToast({ message: data.error ?? "Re-verification failed", type: "error" });
        return;
      }

      setCurrentScore(data.trustScore);
      setCurrentClaims(data.verifiedClaims);
      setLastVerified(new Date().toISOString());
      setToast({ message: `Re-verified: trust score ${data.trustScore}/100`, type: "success" });
    } catch {
      setToast({ message: "Network error during re-verification", type: "error" });
    } finally {
      setReverifying(false);
    }
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-default space-y-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-soft text-info-fill">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
            </svg>
          </div>
          <div>
            <h2 className="font-serif text-lg text-text-primary">Verification</h2>
            <p className="text-xs text-text-muted">
              Public-API credential verification
              {lastVerified && (
                <> &middot; Last run: {new Date(lastVerified).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}</>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Maturity badge (admin-only panel). M7 = attorney-ready; anything
              below means the lead is NOT marketplace-visible. Flag the broken
              state where M7 is claimed but trust is below the bar. */}
          <div className="rounded-lg border border-border-default bg-surface-subtle px-3 py-1.5 text-center">
            <div className="text-xs text-text-muted">Stage</div>
            <div className="text-lg font-bold tabular-nums text-text-secondary">
              {currentMaturity}
              {currentMaturity === "M7" && currentScore < 60 && (
                <span className="ml-1 align-middle text-[10px] font-semibold uppercase text-danger-fill" title="M7 requires trust ≥ 60 — this lead is mis-graded">
                  ⚠ low trust
                </span>
              )}
            </div>
          </div>

          {/* Trust score badge — gate-aligned: 60 = attorney-ready (not 40) */}
          <div className={`rounded-lg px-3 py-1.5 text-center ${
            currentScore >= 60 ? "bg-success-bg border border-success-border" :
            currentScore >= 40 ? "bg-warning-bg border border-warning-border" :
            currentScore > 0 ? "bg-danger-bg border border-danger-border" :
            "bg-surface-subtle border border-border-default"
          }`}>
            <div className="text-xs text-text-muted">Trust</div>
            <div className={`text-lg font-bold tabular-nums ${
              currentScore >= 60 ? "text-success-text" :
              currentScore >= 40 ? "text-warning-text" :
              currentScore > 0 ? "text-danger-text" :
              "text-text-muted"
            }`}>{currentScore}<span className="text-xs font-normal text-text-muted">/100</span></div>
          </div>

          {/* Re-verify button */}
          <button
            onClick={handleReverify}
            disabled={reverifying}
            className="btn btn-secondary text-sm"
          >
            {reverifying ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying...
              </span>
            ) : "Re-verify"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mx-6 mt-3 rounded-lg px-4 py-2 text-sm ${
          toast.type === "success" ? "bg-success-bg text-success-text border border-success-border" : "bg-danger-bg text-danger-text border border-danger-border"
        }`}>
          {toast.message}
        </div>
      )}

      {/* Machine verdict + component breakdown — the diagnostic at a glance */}
      {(level || breakdown) && (
        <div className="px-6 pt-4 space-y-3 border-b border-border-subtle pb-4">
          {level && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                level === "identity_confirmed" ? "bg-success-bg border-success-border text-success-text"
                : level === "publicly_corroborated" ? "bg-info-bg border-info-border text-info-text"
                : "bg-surface-subtle border-border-default text-text-muted"
              }`}>{LEVEL_LABEL[level]}</span>
              <span className="text-xs text-text-secondary">
                {countedCount} source{countedCount === 1 ? "" : "s"} counted
                {excludedCount > 0 && ` · ${excludedCount} excluded as namesake/unconfirmed`}
              </span>
            </div>
          )}
          {aggregate && <p className="text-xs text-text-muted">{aggregate}</p>}
          {breakdown && (
            <div className="space-y-1.5 pt-1">
              <BreakdownBar label="Identity" value={breakdown.identity} cap={breakdown.identityCap} />
              <BreakdownBar label="Substance" value={breakdown.substance} cap={breakdown.substanceCap} />
              <BreakdownBar label="Consistency" value={breakdown.consistency} cap={breakdown.consistencyCap} />
              <BreakdownBar label="Institution" value={breakdown.institution} cap={breakdown.institutionCap} />
            </div>
          )}
        </div>
      )}

      {/* Claims table */}
      {claimEntries.length > 0 ? (
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Claim</th>
                <th className="py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Confidence</th>
                <th className="py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Source</th>
                <th className="py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {claimEntries.map(([key, claim]) => {
                const config = STATUS_CONFIG[claim.status] ?? STATUS_CONFIG.inconclusive;
                return (
                  <tr key={key}>
                    <td className="py-2.5 font-medium text-text-primary">
                      {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </td>
                    <td className="py-2.5">
                      <span className={config.badgeClass}>{config.label}</span>
                    </td>
                    <td className="py-2.5 tabular-nums text-text-secondary">
                      {/* Only show confidence when the status is meaningful — an
                          "Inconclusive · 100%" display misleads; inconclusive means
                          the match was uncertain regardless of the raw score */}
                      {(claim.status === "verified" || claim.status === "self_reported") && claim.confidence > 0
                        ? `${Math.round(claim.confidence * 100)}%`
                        : "—"}
                    </td>
                    <td className="py-2.5">
                      {claim.sourceUrl ? (
                        <a
                          href={claim.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-info-fill hover:text-info-text underline text-xs"
                        >
                          {claim.source}
                        </a>
                      ) : (
                        <span className="text-text-muted text-xs">{claim.source}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-xs text-text-secondary">
                      {claim.detail ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-8 text-center text-text-muted text-sm">
          No verification data yet. Click Re-verify to run public-API lookups.
        </div>
      )}

      {/* Admin attestation — shown when lead hasn't cleared the M7 gate automatically,
          or when already attested (to show the attestation record). */}
      {(currentScore < 60 || currentMaturity !== "M7" || adminAttested) && (
        <div className="border-t border-border-subtle">
          {adminAttested ? (
            <div className="px-6 py-4 flex items-start gap-3">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-bg text-warning-text text-xs font-bold">
                A
              </div>
              <div className="text-sm">
                <span className="font-medium text-text-primary">Admin-attested identity</span>
                {attestedBy && (
                  <span className="ml-2 text-text-muted text-xs">by {attestedBy}</span>
                )}
                {attestedAt && (
                  <span className="ml-1 text-text-muted text-xs">
                    on {new Date(attestedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                {attestedReason && (
                  <p className="mt-1 text-text-secondary text-xs">{attestedReason}</p>
                )}
              </div>
            </div>
          ) : showAttestForm ? (
            <div className="px-6 py-4 space-y-3">
              <p className="text-sm font-medium text-text-primary">Attest identity</p>
              <p className="text-xs text-text-muted">
                Use this when automated verification falls short due to thin public profiles (sparse ORCID,
                no DOI index, name collision). Provide your reason — it is stored permanently for audit.
              </p>
              <textarea
                value={attestReason}
                onChange={(e) => setAttestReason(e.target.value)}
                placeholder="e.g. Verified passport + university faculty page; ORCID profile is sparse because institution didn't register DOIs until 2022."
                rows={3}
                className="w-full rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-info-fill resize-none"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAttest}
                  disabled={attesting || !attestReason.trim()}
                  className="btn btn-primary text-sm"
                >
                  {attesting ? "Attesting…" : "Confirm attestation"}
                </button>
                <button
                  onClick={() => { setShowAttestForm(false); setAttestReason(""); }}
                  className="btn btn-ghost text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="px-6 py-3 flex items-center justify-between">
              <p className="text-xs text-text-muted">
                Trust score {currentScore}/100 — below the 60-point attorney-ready gate.
              </p>
              <button
                onClick={() => setShowAttestForm(true)}
                className="btn btn-ghost text-sm text-warning-text hover:bg-warning-bg"
              >
                Attest identity
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audit log (collapsible) */}
      {events.length > 0 && (
        <div className="border-t border-border-subtle">
          <button
            onClick={() => setShowAuditLog(!showAuditLog)}
            className="w-full flex items-center justify-between px-6 py-3 text-sm text-text-muted hover:bg-surface-muted transition-colors"
          >
            <span>Audit log ({events.length} events)</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 transition-transform ${showAuditLog ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </button>

          {showAuditLog && (
            <div className="px-6 pb-4 max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="py-1.5 text-left font-semibold text-text-muted uppercase">Time</th>
                    <th className="py-1.5 text-left font-semibold text-text-muted uppercase">Source</th>
                    <th className="py-1.5 text-left font-semibold text-text-muted uppercase">Action</th>
                    <th className="py-1.5 text-left font-semibold text-text-muted uppercase">Result</th>
                    <th className="py-1.5 text-left font-semibold text-text-muted uppercase">Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td className="py-1.5 tabular-nums text-text-muted whitespace-nowrap">
                        {new Date(event.createdAt).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="py-1.5 text-text-secondary">{event.source}</td>
                      <td className="py-1.5 text-text-secondary">{event.action}</td>
                      <td className="py-1.5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs ${RESULT_BADGE[event.result] ?? "text-text-secondary bg-surface-subtle"}`}>
                          {event.result}
                        </span>
                      </td>
                      <td className="py-1.5">
                        {event.evidenceRef ? (
                          <a
                            href={event.evidenceRef}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-info-fill hover:text-info-text underline"
                          >
                            link
                          </a>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
