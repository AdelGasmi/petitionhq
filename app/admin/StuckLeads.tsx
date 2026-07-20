"use client";

import { useState } from "react";
import Link from "next/link";

type StuckLead = {
  id: string;
  name: string | null;
  field: string;
  trustScore: number;
  capturedAt: string;
};

/**
 * Admin dashboard "stuck leads" list with IN-PLACE re-verification.
 * Each row POSTs to /api/admin/leads/[id]/reverify and updates its own score
 * without navigating away. A lead that clears the 60-gate flips to a "cleared"
 * link instead of staying actionable.
 */
export function StuckLeads({ leads }: { leads: StuckLead[] }) {
  return (
    <div className="divide-y divide-border-subtle">
      {leads.map((lead) => (
        <StuckLeadRow key={lead.id} lead={lead} />
      ))}
    </div>
  );
}

function StuckLeadRow({ lead }: { lead: StuckLead }) {
  const [score, setScore] = useState(lead.trustScore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ran, setRan] = useState(false);

  async function reverify() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/reverify`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Re-verify failed");
        return;
      }
      setScore(typeof data.trustScore === "number" ? data.trustScore : score);
      setRan(true);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const cleared = score >= 60;

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-text-primary">{lead.name ?? "—"}</p>
        <p className="text-xs text-text-muted">
          {lead.field} · captured {new Date(lead.capturedAt).toLocaleDateString()}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {error && <span className="text-xs text-danger-text">{error}</span>}
        {ran && !cleared && !error && <span className="text-xs text-text-muted">still below 60</span>}
        <span className={`text-sm font-medium tabular-nums ${cleared ? "text-success-text" : "text-warning-text"}`}>
          {score}/100
        </span>
        {cleared ? (
          <Link href={`/leads/${lead.id}`} className="badge badge-success">Cleared →</Link>
        ) : (
          <button
            onClick={reverify}
            disabled={loading}
            className="btn btn-secondary px-2 py-1 text-xs"
          >
            {loading ? "Verifying…" : ran ? "Re-verify again" : "Re-verify"}
          </button>
        )}
      </div>
    </div>
  );
}
