"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type GateAtom = {
  id: string;
  kind: string;
  summary: string;
  detail?: string;
  year?: number;
  metric?: string;
  /** Fork-C display badge — display-only, the attorney still decides. */
  verified: boolean;
};

type Props = {
  leadId: string;
  atoms: GateAtom[];
  /** Atom IDs to seed as approved (existing ledger, or all atoms if un-curated). */
  initialApproved: string[];
  /** Set when a signed ledger already exists. */
  attested: { ledgerRoot: string; attestedAt: string } | null;
};

const KIND_LABEL: Record<string, string> = {
  publication: "Publication",
  grant: "Grant",
  patent: "Patent",
  award: "Award",
  talk: "Invited talk",
  role: "Editorial / review",
  media: "Media",
  project: "Project",
};

export function ClaimGate({ leadId, atoms, initialApproved, attested }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialApproved),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const openedRef = useRef(false);

  // Fire the "gate opened" funnel beacon once (StrictMode-safe via ref guard).
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    fetch(`/api/leads/${leadId}/claim-ledger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "open" }),
    }).catch(() => {});
  }, [leadId]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const approvedCount = selected.size;
  const excludedCount = atoms.length - approvedCount;

  const handleAttest = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${leadId}/claim-ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "attest", approved: [...selected] }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save. Please try again.");
        setSaving(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error — please try again.");
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border-default bg-surface-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border-subtle">
        <h2 className="font-serif text-lg">Approve Claim Set</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Only approved claims are written into the generated petition. Uncheck
          anything you can&apos;t stand behind, then sign the set. The verification
          badge is informational — you decide.
        </p>
      </div>

      {attested && (
        <div className="px-6 py-3 bg-success-bg/60 border-b border-success-soft flex items-center gap-2 text-sm text-success-text">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span>
            Signed claim set{" "}
            <code className="font-mono text-xs">#{attested.ledgerRoot.slice(0, 12)}</code>
            {" · "}
            {new Date(attested.attestedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            . Re-sign below if you change the set.
          </span>
        </div>
      )}

      <ul className="divide-y divide-border-subtle">
        {atoms.map((atom) => {
          const checked = selected.has(atom.id);
          const meta = [
            atom.year ? String(atom.year) : null,
            atom.metric ?? null,
          ].filter(Boolean);
          return (
            <li key={atom.id} className="px-6 py-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(atom.id)}
                  className="mt-1 h-4 w-4 rounded border-border-default text-info-fill focus:ring-info-fill"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                      {KIND_LABEL[atom.kind] ?? atom.kind}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        atom.verified
                          ? "bg-success-soft text-success-text"
                          : "bg-surface-muted text-text-muted"
                      }`}
                    >
                      {atom.verified ? "Corroborated" : "Self-reported"}
                    </span>
                  </span>
                  <span
                    className={`mt-0.5 block text-sm ${
                      checked ? "text-text-primary" : "text-text-muted line-through"
                    }`}
                  >
                    {atom.summary}
                  </span>
                  {(atom.detail || meta.length > 0) && (
                    <span className="mt-0.5 block text-xs text-text-muted">
                      {[atom.detail, ...meta].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="px-6 py-4 border-t border-border-subtle flex items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{approvedCount}</strong> of{" "}
          {atoms.length} approved
          {excludedCount > 0 && (
            <span className="text-text-muted"> · {excludedCount} excluded</span>
          )}
        </p>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleAttest}
            disabled={saving}
            className="btn btn-primary text-sm"
          >
            {saving
              ? "Signing…"
              : attested
                ? "Re-sign claim set"
                : "Approve claim set"}
          </button>
          {error && <p className="text-xs text-danger-fill text-right">{error}</p>}
        </div>
      </div>
    </div>
  );
}
