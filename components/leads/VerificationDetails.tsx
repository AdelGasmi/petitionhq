import { Check, AlertTriangle, XMark, ExternalLink } from "@/components/icons";
import { LEVEL_LABEL, type VerificationLevel } from "@/lib/verification/level";

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
  /**
   * Source/reference links resolve to the applicant's public profile
   * (OpenAlex/ORCID/etc.) and would de-anonymize them. Only expose them
   * after the attorney has claimed the lead.
   */
  isClaimed?: boolean;
};

const CLAIM_LABELS: Record<string, string> = {
  researcher_profile: "Research profile",
  publications: "Publications",
  orcid: "ORCID",
  institution: "Institution",
  nsf_grants: "NSF grants",
  nih_grants: "NIH grants",
  patents: "Patents",
  semantic_scholar: "Semantic Scholar profile",
  arxiv_preprints: "arXiv preprints",
  dblp_publications: "DBLP (CS) publications",
  pubmed_publications: "PubMed publications",
  crossref_citations: "Crossref cross-validation",
  awards: "Awards",
  peerReview: "Peer review roles",
  invitedTalks: "Invited talks",
};

const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  orcid: "ORCID",
  ror: "ROR",
  nsf: "NSF Award Search",
  nih: "NIH RePORTER",
  uspto: "USPTO PatentsView",
  crossref: "Crossref",
  semantic_scholar: "Semantic Scholar",
  arxiv: "arXiv",
  dblp: "DBLP",
  pubmed: "PubMed",
};

// Internal bookkeeping keys that aren't applicant claims.
const HIDDEN_CLAIM_KEYS = new Set(["preliminary", "_aggregate", "_breakdown", "_verificationLevel"]);

type Breakdown = {
  identity: number; identityCap: number;
  substance: number; substanceCap: number;
  consistency: number; consistencyCap: number;
  institution: number; institutionCap: number;
};

function parseBreakdown(verifiedClaims: Record<string, ClaimResult>): Breakdown | null {
  const raw = verifiedClaims["_breakdown"]?.detail;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Breakdown;
  } catch {
    return null;
  }
}

// The aggregate claim records "… N works, M citations aggregated across …"
// (orchestrator). Parse it for the record-substance tile so we can show identity
// and record as two separate axes instead of one fused number.
function parseAggregate(verifiedClaims: Record<string, ClaimResult>): { works: number; citations: number } | null {
  const d = verifiedClaims["_aggregate"]?.detail;
  if (!d) return null;
  const w = d.match(/(\d+)\s+works/);
  const c = d.match(/(\d+)\s+citations/);
  if (!w && !c) return null;
  return { works: w ? parseInt(w[1], 10) : 0, citations: c ? parseInt(c[1], 10) : 0 };
}

function BreakdownBar({ label, value, cap }: { label: string; value: number; cap: number }) {
  const pct = Math.max(0, Math.min(100, (value / cap) * 100));
  const colorClass = pct >= 70 ? "bg-success-fill" : pct >= 40 ? "bg-warning-fill" : value < 0 ? "bg-danger-fill" : "bg-surface-muted";
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-36 text-text-muted shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-muted overflow-hidden">
        <div className={`h-1.5 rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right tabular-nums text-text-secondary shrink-0">
        {value >= 0 ? value : value}/{cap}
      </span>
    </div>
  );
}

// Deterministic one-sentence narrative from verifiedClaims data.
// Attorneys buy the conclusion; the table is the audit trail.
function buildNarrative(
  entries: [string, ClaimResult][],
  trustScore: number,
): string {
  const verified = entries.filter(([, c]) => c.status === "verified");
  const uniqueSources = new Set(verified.map(([, c]) => SOURCE_LABELS[c.source] ?? c.source));
  const n = uniqueSources.size;
  const sourceList = [...uniqueSources].slice(0, 3).join(", ");

  if (n === 0) {
    return trustScore >= 60
      ? "Verification is in progress; credentials have been reviewed against public records."
      : "Automated verification did not find independent confirmation for this applicant's claims.";
  }
  if (n === 1) {
    return `One independent source (${sourceList}) has confirmed credentials for this applicant.`;
  }
  const confidence = trustScore >= 80 ? "strong" : trustScore >= 60 ? "solid" : "partial";
  return `${n} independent sources (${sourceList}) provide ${confidence} corroboration of this researcher's credentials and identity.`;
}

/**
 * Attorney-facing verification & provenance section.
 * Layout: narrative conclusion → score + breakdown bars → collapsed audit table.
 * Attorneys buy the conclusion; the table is the audit trail.
 */
export function VerificationDetails({ trustScore, verifiedClaims, isClaimed = false }: Props) {
  const breakdown = parseBreakdown(verifiedClaims);
  const level = (verifiedClaims["_verificationLevel"]?.detail ?? null) as VerificationLevel | null;
  const entries = Object.entries(verifiedClaims)
    .filter(([key]) => !HIDDEN_CLAIM_KEYS.has(key))
    .sort(([, a], [, b]) => {
      const order: Record<string, number> = { verified: 0, self_reported: 1, ambiguous: 2, not_found: 3, contradicted: 4 };
      return (order[a.status] ?? 5) - (order[b.status] ?? 5);
    });

  if (entries.length === 0) return null;

  const narrative = buildNarrative(entries, trustScore);

  // Two-axis read: identity (is it them?) vs record (how much verified output?).
  // Showing these separately stops a confirmed-but-modest researcher from
  // reading as "low trust" — and stops a thin unconfirmed match from hiding
  // behind a mid score.
  const agg = parseAggregate(verifiedClaims);
  const verifiedSources = [
    ...new Set(
      entries.filter(([, c]) => c.status === "verified").map(([, c]) => SOURCE_LABELS[c.source] ?? c.source),
    ),
  ];
  const identityLabel = level
    ? LEVEL_LABEL[level]
    : trustScore >= 60
    ? "Publicly corroborated"
    : "Not independently confirmed";
  const recordLine = agg && (agg.works > 0 || agg.citations > 0)
    ? `${agg.works} works · ${agg.citations} citations`
    : "No public record matched";
  const recordQualifier = !agg || (agg.works === 0 && agg.citations === 0)
    ? "limited public footprint"
    : agg.citations >= 200
    ? "established record"
    : agg.citations >= 50
    ? "growing record"
    : "early-stage record";

  return (
    <div className="rounded-xl border border-border-default bg-surface-card overflow-hidden">
      {/* ── Narrative + score header ── */}
      <div className="px-6 py-5 border-b border-border-subtle">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-lg text-text-primary">Verification</h2>
              {level && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
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
            </div>
            {/* One-sentence conclusion — attorneys read this first */}
            <p className="mt-1.5 text-sm text-text-primary leading-relaxed font-medium">
              {narrative}
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Publicly corroborated from independent sources. Existence of matching records confirmed; identity ownership is self-reported unless ORCID OAuth.{" "}
              <a href="/verification" className="text-info-fill hover:underline">Methodology →</a>
            </p>
          </div>
          {/* Trust score badge — gate-aligned: 60 = attorney-ready */}
          <div className={`shrink-0 rounded-lg px-3 py-1.5 text-center ${
            trustScore >= 60 ? "bg-success-bg border border-success-border"
            : trustScore >= 40 ? "bg-warning-bg border border-warning-border"
            : trustScore > 0 ? "bg-danger-bg border border-danger-border"
            : "bg-surface-subtle border border-border-default"
          }`}>
            <div className="text-xs text-text-muted">Trust</div>
            <div className={`text-lg font-bold tabular-nums ${
              trustScore >= 60 ? "text-success-text"
              : trustScore >= 40 ? "text-warning-text"
              : trustScore > 0 ? "text-danger-text"
              : "text-text-muted"
            }`}>
              {trustScore}<span className="text-xs font-normal text-text-muted">/100</span>
            </div>
          </div>
        </div>

        {/* Two-axis read: identity vs record — the headline, before the bars */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="rounded-lg bg-surface-subtle px-3 py-2">
            <div className="text-xs text-text-muted uppercase tracking-wider">Identity</div>
            <div className={`mt-0.5 text-sm font-medium ${
              level === "identity_confirmed" ? "text-success-text"
              : level === "self_reported" ? "text-text-muted"
              : "text-info-text"
            }`}>{identityLabel}</div>
            <div className="text-xs text-text-secondary mt-0.5">
              {verifiedSources.length > 0 ? verifiedSources.slice(0, 3).join(" · ") : "no independent source"}
            </div>
          </div>
          <div className="rounded-lg bg-surface-subtle px-3 py-2">
            <div className="text-xs text-text-muted uppercase tracking-wider">Research record</div>
            <div className="mt-0.5 text-sm font-medium text-text-primary">{recordLine}</div>
            <div className="text-xs text-text-secondary mt-0.5">{recordQualifier}</div>
          </div>
        </div>

        {/* Component breakdown bars — prominent, before the table */}
        {breakdown && (
          <div className="mt-4 space-y-2">
            <BreakdownBar label="Identity corroboration" value={breakdown.identity} cap={breakdown.identityCap} />
            <BreakdownBar label="Publication substance" value={breakdown.substance} cap={breakdown.substanceCap} />
            <BreakdownBar label="Claim consistency" value={breakdown.consistency} cap={breakdown.consistencyCap} />
            <BreakdownBar label="Institution / funding" value={breakdown.institution} cap={breakdown.institutionCap} />
          </div>
        )}
      </div>

      {/* ── Audit table — collapsed by default; attorneys open when needed ── */}
      <details className="group">
        <summary className="flex items-center justify-between px-6 py-3 cursor-pointer text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors list-none">
          <span>Full verification detail ({entries.length} claims)</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 transition-transform group-open:rotate-180"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </summary>

      <div className="table-scroll border-t border-border-subtle">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle border-b border-border-subtle">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">Claim</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-28">Status</th>
            <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-32">Source</th>
            {isClaimed && (
              <th className="px-4 py-2 text-left text-xs font-semibold text-text-muted uppercase tracking-wider w-24">Reference</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {entries.map(([key, claim]) => {
            const isVerified = claim.status === "verified";
            const isSelfReported = claim.status === "self_reported";
            const isContradicted = claim.status === "contradicted";
            const isAmbiguous = claim.status === "ambiguous";
            const label = CLAIM_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            const sourceLabel = SOURCE_LABELS[claim.source] ?? claim.source;

            // Pre-claim: suppress details that could de-anonymize the applicant.
            // - ORCID ID (resolves directly to their public profile)
            // - Institution name (field + institution + citation count is findable)
            // Both sourceUrl links are already gated on isClaimed.
            const displayDetail = (() => {
              if (!isClaimed) {
                if (key === "orcid" && claim.detail)
                  return claim.detail.replace(/ORCID\s+[\dX-]+,?\s*/gi, "").trim() || undefined;
                if (key === "institution")
                  return undefined;
              }
              return claim.detail;
            })();

            return (
              <tr key={key} className={
                isSelfReported ? "bg-warning-bg"
                : isContradicted ? "bg-danger-bg"
                : isAmbiguous ? "bg-surface-subtle"
                : ""
              }>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-text-primary">{label}</div>
                  {displayDetail && <div className="text-xs text-text-muted mt-0.5">{displayDetail}</div>}
                </td>
                <td className="px-4 py-2.5">
                  {isVerified && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-success-text">
                      <Check className="h-3.5 w-3.5" />
                      Corroborated
                    </span>
                  )}
                  {isAmbiguous && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted" title="Name-matched a record we could not tie to this applicant — excluded so a namesake never inflates the score">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Excluded
                    </span>
                  )}
                  {isSelfReported && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-warning-text italic">
                      Self-reported
                    </span>
                  )}
                  {isContradicted && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-danger-text">
                      <XMark className="h-3.5 w-3.5" />
                      Contradicted
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-text-muted">
                  {isSelfReported ? "—" : sourceLabel}
                </td>
                {isClaimed && (
                  <td className="px-4 py-2.5">
                    {claim.sourceUrl && (isVerified || isAmbiguous) ? (
                      <a
                        href={claim.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-verify-fill hover:underline"
                      >
                        View
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-text-disabled">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      </details>
    </div>
  );
}
