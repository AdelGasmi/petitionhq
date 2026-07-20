"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Case } from "@/lib/db";
import type { FormConfig } from "@/forms/types";

type Attorney = { id: string; name: string };

type Props = {
  cases: Case[];
  forms: Record<string, FormConfig | undefined>;
  attorneys: Attorney[];
};

const STATUS_STYLE: Record<string, string> = {
  draft:  "bg-surface-muted text-text-secondary",
  review: "bg-info-soft text-info-text",
  ready:  "bg-success-soft text-success-text",
  filed:  "bg-surface-muted text-text-muted",
};

const STATUSES = ["draft", "review", "ready", "filed"] as const;

export function CasesListAdmin({ cases, forms, attorneys }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<"reassign" | "status" | "delete" | "">("");
  const [targetAttorney, setTargetAttorney] = useState(attorneys[0]?.id ?? "");
  const [targetStatus, setTargetStatus] = useState<string>("draft");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Search / filter state
  const [query, setQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterAttorney, setFilterAttorney] = useState<string>("");

  const filtered = cases.filter((c) => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterAttorney) {
      if (filterAttorney === "__none__" && c.attorneyId) return false;
      if (filterAttorney !== "__none__" && c.attorneyId !== filterAttorney) return false;
    }
    if (query) {
      const q = query.toLowerCase();
      const attorneyName = attorneys.find((a) => a.id === c.attorneyId)?.name ?? "";
      if (
        !c.title.toLowerCase().includes(q) &&
        !attorneyName.toLowerCase().includes(q) &&
        !c.formId.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...filtered.map((c) => c.id)]));
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setAction("");
    setError("");
  }, []);

  const applyAction = async () => {
    if (!action || selected.size === 0) return;
    const caseIds = [...selected];

    if (action === "delete") {
      if (!confirm(`Delete ${caseIds.length} case${caseIds.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    }

    setBusy(true);
    setError("");

    let res: Response;
    if (action === "delete") {
      res = await fetch("/api/admin/bulk-cases", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds }),
      });
    } else {
      res = await fetch("/api/admin/bulk-cases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          caseIds,
          ...(action === "reassign" ? { attorneyId: targetAttorney } : {}),
          ...(action === "status"   ? { status: targetStatus }        : {}),
        }),
      });
    }

    setBusy(false);
    if (res.ok) {
      clearSelection();
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search + filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          className="input flex-1 min-w-[200px]"
          placeholder="Search by title, attorney, or form…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input w-auto"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
        <select
          className="input w-auto"
          value={filterAttorney}
          onChange={(e) => setFilterAttorney(e.target.value)}
        >
          <option value="">All attorneys</option>
          <option value="__none__">No attorney</option>
          {attorneys.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {(query || filterStatus || filterAttorney) && (
          <button
            type="button"
            className="text-xs text-text-muted hover:text-text-secondary"
            onClick={() => { setQuery(""); setFilterStatus(""); setFilterAttorney(""); }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-surface-subtle px-4 py-3">
          <span className="text-sm font-medium text-text-secondary">
            {selected.size} selected
          </span>

          <select
            className="input max-w-[180px] py-1 text-sm"
            value={action}
            onChange={(e) => setAction(e.target.value as typeof action)}
          >
            <option value="">Choose action…</option>
            <option value="reassign">Reassign attorney</option>
            <option value="status">Change status</option>
            <option value="delete">Delete</option>
          </select>

          {action === "reassign" && (
            <select
              className="input max-w-[220px] py-1 text-sm"
              value={targetAttorney}
              onChange={(e) => setTargetAttorney(e.target.value)}
            >
              {attorneys.length === 0
                ? <option value="">No attorneys</option>
                : attorneys.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))
              }
            </select>
          )}

          {action === "status" && (
            <select
              className="input max-w-[160px] py-1 text-sm"
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value)}
            >
              {STATUSES.map((s) => (
                <option key={s} value={s} className="capitalize">{s}</option>
              ))}
            </select>
          )}

          {action && (
            <button
              type="button"
              className={`btn shrink-0 text-sm ${action === "delete" ? "bg-danger-fill text-white hover:bg-danger-fill" : "btn-primary"}`}
              onClick={applyAction}
              disabled={busy}
            >
              {busy ? "Working…" : action === "delete" ? "Delete" : "Apply"}
            </button>
          )}

          <button
            type="button"
            className="ml-auto text-xs text-text-muted hover:text-text-secondary"
            onClick={clearSelection}
          >
            Clear
          </button>

          {error && <p className="w-full text-xs text-danger-fill">{error}</p>}
        </div>
      )}

      {/* Header row with select-all */}
      <div className="flex items-center gap-3 px-1">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border-default"
          checked={allSelected}
          onChange={toggleAll}
          title="Select all visible"
        />
        <span className="text-xs text-text-muted">
          {filtered.length === cases.length
            ? `${cases.length} case${cases.length !== 1 ? "s" : ""}`
            : `${filtered.length} of ${cases.length} cases`}
        </span>
      </div>

      {/* Case rows */}
      {filtered.length === 0 && (
        <p className="card text-sm text-text-muted">No cases match your filters.</p>
      )}
      <div className="space-y-2">
        {filtered.map((c) => {
          const form = forms[c.formId];
          const docsCount = Object.keys(c.documents).length;
          const lettersCount = Object.keys(c.letters).length;
          const isSelected = selected.has(c.id);

          return (
            <div
              key={c.id}
              className={`card flex items-start gap-3 transition-colors ${
                isSelected ? "border-border-strong bg-surface-subtle" : ""
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-border-default"
                checked={isSelected}
                onChange={() => toggle(c.id)}
              />
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={(e) => {
                  if (selected.size > 0) {
                    toggle(c.id);
                  } else {
                    // Navigate to restricted admin case view (notes + payment only)
                    window.location.href = `/cases/${c.id}`;
                  }
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-serif text-lg tracking-tight">
                      Case #{c.id.slice(0, 8)} · {form?.shortTitle ?? c.formId}
                    </div>
                    <div className="mt-1 text-sm text-text-secondary">
                      {c.attorneyId
                        ? `${attorneys.find((a) => a.id === c.attorneyId)?.name ?? "attorney"}`
                        : <span className="text-warning-text">no attorney</span>}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {docsCount} doc{docsCount !== 1 ? "s" : ""} ·{" "}
                      {lettersCount} letter{lettersCount !== 1 ? "s" : ""} ·{" "}
                      Updated {new Date(c.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? "bg-surface-muted text-text-secondary"}`}>
                      {c.status}
                    </span>
                    {c.reviewStatus === "pending" && (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
                        review pending
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
