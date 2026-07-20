"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { LeadSnippet } from "./snippet";
import { Lock } from "@/components/icons";
import { DeliverButton } from "../pilot/DeliverButton";
import { BetaConvertButton } from "./BetaConvertButton";
import { BetaReverseButton } from "./BetaReverseButton";

const DAY_MS = 86_400_000;
const STALE_DAYS = 14;

export type LeadRow = {
  id: string;
  name: string | null;
  email: string;
  maturity: string;
  trustScore: number;
  tier: string | null;
  tierLabel: string | null;
  score: number | null;
  status: string;
  statusLabel: string;
  dossierStatus: string | null;
  cost: number | null;
  capturedAt: string; // ISO
  claimed: boolean;
  consented: boolean;
  delivered: boolean;
  deliveredFirm: string | null;
  awaitingMatch: boolean;
  betaInvited: boolean;
  betaEligible: boolean;
  snippet: LeadSnippet;
};

export type SortKey =
  | "name" | "maturity" | "trustScore" | "tier" | "score" | "status" | "cost" | "capturedAt";

type Props = {
  rows: LeadRow[];
  sort: SortKey;
  dir: "asc" | "desc";
  // preserved filter params so sort/search links don't drop them
  tier?: string;
  status?: string;
  maturity?: string;
  trust?: string;
  dossier?: string;
  consent?: string;
  q?: string;
};

const MATURITY_BADGE: Record<string, string> = {
  M0: "badge badge-neutral", M1: "badge badge-info", M2: "badge badge-info",
  M3: "badge badge-warning", M4: "badge badge-warning", M5: "badge badge-info",
  M6: "badge badge-info", M7: "badge badge-success",
};
const TIER_BADGE: Record<string, string> = {
  tier1: "badge badge-success", tier2: "badge badge-warning", tier3: "badge badge-neutral",
};
const STATUS_BADGE: Record<string, string> = {
  new: "badge badge-info", open: "badge badge-info", contacted: "badge badge-neutral",
  claimed: "badge badge-warning", converted: "badge badge-success", disqualified: "badge badge-neutral",
};
const DOSSIER_BADGE: Record<string, string> = {
  completed: "badge badge-success", pending: "badge badge-info",
  processing: "badge badge-info", failed: "badge badge-danger",
};

const COLUMNS: { key: SortKey; label: string; align?: string }[] = [
  { key: "name", label: "Applicant" },
  { key: "maturity", label: "Maturity" },
  { key: "trustScore", label: "Trust" },
  { key: "tier", label: "Tier" },
  { key: "score", label: "Score" },
  { key: "status", label: "Status" },
  { key: "cost", label: "Cost" },
  { key: "capturedAt", label: "Captured" },
];

export function LeadsTable({ rows, sort, dir, tier, status, maturity, trust, dossier, consent, q }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rowAction, setRowAction] = useState<Record<string, string>>({}); // leadId → "reverify"|"archive"|"done"|error

  const deletable = useMemo(() => rows.filter((r) => !r.claimed), [rows]);
  const allSelected = deletable.length > 0 && deletable.every((r) => selected.has(r.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(deletable.map((r) => r.id)));
  }

  function sortHref(key: SortKey): string {
    const nextDir = sort === key && dir === "desc" ? "asc" : "desc";
    const p = new URLSearchParams();
    if (tier) p.set("tier", tier);
    if (status) p.set("status", status);
    if (maturity) p.set("maturity", maturity);
    if (trust) p.set("trust", trust);
    if (dossier) p.set("dossier", dossier);
    if (consent) p.set("consent", consent);
    if (q) p.set("q", q);
    p.set("sort", key);
    p.set("dir", nextDir);
    return `/admin/leads?${p.toString()}`;
  }

  async function reverify(id: string) {
    setRowAction((prev) => ({ ...prev, [id]: "reverify" }));
    try {
      const res = await fetch(`/api/admin/leads/${id}/reverify`, { method: "POST" });
      const data = await res.json();
      setRowAction((prev) => ({
        ...prev,
        [id]: res.ok ? `trust→${data.trustScore}` : `err: ${data.error ?? "failed"}`,
      }));
      if (res.ok) router.refresh();
    } catch {
      setRowAction((prev) => ({ ...prev, [id]: "network error" }));
    }
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this lead? It will be marked Disqualified.")) return;
    setRowAction((prev) => ({ ...prev, [id]: "archive" }));
    try {
      const res = await fetch(`/api/admin/leads/${id}`, { method: "PATCH" });
      const data = await res.json();
      setRowAction((prev) => ({
        ...prev,
        [id]: res.ok ? "archived" : `err: ${data.error ?? "failed"}`,
      }));
      if (res.ok) router.refresh();
    } catch {
      setRowAction((prev) => ({ ...prev, [id]: "network error" }));
    }
  }

  async function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "this lead" : `${ids.length} leads`;
    if (!window.confirm(`Permanently delete ${label}? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/admin/leads/${id}`, { method: "DELETE" })),
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setError(`${failed.length} of ${ids.length} could not be deleted (claimed leads must be released first).`);
      }
      setSelected(new Set());
      router.refresh();
    } catch {
      setError("Network error while deleting.");
    } finally {
      setBusy(false);
    }
  }

  const arrow = (key: SortKey) => (sort === key ? (dir === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="space-y-3">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border-default bg-surface-muted px-4 py-2 text-sm">
          <span className="text-text-secondary">{selected.size} selected</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelected(new Set())} className="text-text-muted hover:text-text-primary">
              Clear
            </button>
            <button
              onClick={() => deleteIds([...selected])}
              disabled={busy}
              className="btn btn-danger text-xs disabled:opacity-50"
            >
              {busy ? "Deleting…" : `Delete ${selected.size}`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2 text-sm text-danger-text">
          {error}
        </div>
      )}

      <div className="table-shell">
        <div className="table-scroll">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header-cell w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all deletable"
                    className="h-3.5 w-3.5 rounded border-border-default"
                  />
                </th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="table-header-cell">
                    <Link href={sortHref(c.key)} className="hover:text-text-primary whitespace-nowrap" scroll={false}>
                      {c.label}{arrow(c.key)}
                    </Link>
                  </th>
                ))}
                <th className="table-header-cell">Details</th>
                <th className="table-header-cell" />
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id} className={`table-row ${selected.has(lead.id) ? "bg-surface-muted" : ""}`}>
                  <td className="table-cell align-top">
                    {lead.claimed ? (
                      <span className="inline-flex text-text-muted" title="Claimed — release before deleting"><Lock className="h-4 w-4" /></span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggle(lead.id)}
                        aria-label={`Select ${lead.email}`}
                        className="h-3.5 w-3.5 rounded border-border-default"
                      />
                    )}
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-text-primary">{lead.name || "—"}</div>
                    <div className="text-xs text-text-muted">{lead.email}</div>
                    {lead.awaitingMatch ? (() => {
                      const days = Math.floor((Date.now() - Date.parse(lead.capturedAt)) / DAY_MS);
                      const stale = days >= STALE_DAYS;
                      return (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${stale ? "bg-warning-soft text-warning-text" : "bg-info-soft text-info-text"}`}
                            title={stale ? "Consented and waiting — overdue for an attorney" : "Consented — no attorney has claimed them yet"}
                          >
                            ● Awaiting match{days > 0 ? ` · ${days}d` : ""}
                          </span>
                          <DeliverButton leadId={lead.id} alreadyDelivered={false} />
                        </div>
                      );
                    })() : lead.delivered ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary" title={lead.deliveredFirm ? `Delivered to ${lead.deliveredFirm}` : "Delivered to a firm"}>
                        → Delivered{lead.deliveredFirm ? ` · ${lead.deliveredFirm}` : ""}
                      </span>
                    ) : lead.consented ? (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success-text" title="Consented and claimed by an attorney">
                        ✓ Consented
                      </span>
                    ) : null}
                    {/* Self-petitioner beta invite — available on any eligible lead
                        regardless of matching consent; sends exactly one email. */}
                    {lead.betaInvited ? (
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary" title="Self-petitioner beta invite sent — sent once, never re-sent automatically">
                          ✦ Beta invited
                        </span>
                        <BetaReverseButton leadId={lead.id} />
                      </div>
                    ) : lead.betaEligible ? (
                      <div className="mt-1">
                        <BetaConvertButton leadId={lead.id} />
                      </div>
                    ) : null}
                  </td>
                  <td className="table-cell">
                    <span className={MATURITY_BADGE[lead.maturity] ?? "badge badge-neutral"}>{lead.maturity}</span>
                  </td>
                  <td className="table-cell tabular-nums font-medium">
                    {lead.trustScore > 0 ? `${lead.trustScore}/100` : "—"}
                  </td>
                  <td className="table-cell">
                    {lead.tier ? (
                      <span className={TIER_BADGE[lead.tier] ?? "badge badge-neutral"}>{lead.tierLabel ?? lead.tier}</span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="table-cell tabular-nums font-medium">{lead.score != null ? `${lead.score}/100` : "—"}</td>
                  <td className="table-cell">
                    <span className={STATUS_BADGE[lead.status] ?? "badge badge-neutral"}>{lead.statusLabel}</span>
                  </td>
                  <td className="table-cell tabular-nums text-xs text-text-muted">
                    {lead.cost != null ? `$${(lead.cost / 100).toFixed(2)}` : "—"}
                  </td>
                  <td className="table-cell text-text-muted text-xs whitespace-nowrap">
                    {new Date(lead.capturedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="table-cell align-top">
                    <LeadPeek snippet={lead.snippet} />
                  </td>
                  <td className="table-cell align-top text-right">
                    <div className="flex flex-col items-end gap-1">
                      <Link href={`/leads/${lead.id}`} className="text-text-muted underline hover:text-text-primary text-xs">
                        Full →
                      </Link>
                      {rowAction[lead.id] ? (
                        <span className={`text-xs font-mono ${rowAction[lead.id].startsWith("err") ? "text-danger-text" : "text-success-text"}`}>
                          {rowAction[lead.id] === "reverify" || rowAction[lead.id] === "archive" ? "…" : rowAction[lead.id]}
                        </span>
                      ) : (
                        <>
                          {!lead.claimed && (
                            <button
                              onClick={() => reverify(lead.id)}
                              className="text-info-text/80 hover:text-info-text text-xs"
                            >
                              Re-verify
                            </button>
                          )}
                          {!lead.claimed && lead.status !== "disqualified" && (
                            <button
                              onClick={() => archive(lead.id)}
                              className="text-warning-text/80 hover:text-warning-text text-xs"
                            >
                              Archive
                            </button>
                          )}
                          {!lead.claimed && (
                            <button
                              onClick={() => deleteIds([lead.id])}
                              disabled={busy}
                              className="text-danger-text/80 hover:text-danger-text text-xs disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-border-subtle px-4 py-2 text-xs text-text-muted text-right">
          {rows.length} lead{rows.length !== 1 ? "s" : ""}
          {(tier || status || q) && " (filtered)"}
        </div>
      </div>
    </div>
  );
}

function LeadPeek({ snippet }: { snippet: LeadSnippet }) {
  const { chips, summary, blockers } = snippet;
  if (chips.length === 0 && !summary && !blockers) {
    return <span className="text-text-muted text-xs">No intake data yet</span>;
  }
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-xs text-text-muted underline hover:text-text-primary">
        Peek
      </summary>
      <div className="mt-2 w-80 max-w-[20rem] space-y-3 rounded-lg border border-border-subtle bg-surface-subtle p-3 text-left font-normal normal-case">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c.label} className="badge badge-neutral text-[11px]">
                {c.label}: {c.value}
              </span>
            ))}
          </div>
        )}
        {summary && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">AI summary</div>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{summary}</p>
          </div>
        )}
        {blockers && (
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Key gaps</div>
            <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">{blockers}</p>
          </div>
        )}
      </div>
    </details>
  );
}
