"use client";

/**
 * RecommenderCombobox — one control to type a new recommender OR pick one from
 * intake. Replaces the native <datalist> (which renders as an unstyled OS popup).
 * Styled to the design system, keyboard-accessible, closes on outside click.
 */

import { useEffect, useId, useRef, useState } from "react";

export type ComboRec = {
  name: string;
  title?: string;
  institution?: string;
  credentials?: string;
  relationship?: string;
  email?: string;
  kind?: "independent" | "dependent";
};

export function RecommenderCombobox({
  value,
  options,
  usedNames,
  preferKind,
  placeholder,
  onType,
  onPick,
}: {
  value: string;
  options: ComboRec[];
  usedNames: Set<string>;
  preferKind?: string;
  placeholder?: string;
  /** Free-text typing (no intake match) */
  onType: (name: string) => void;
  /** Picked an intake recommender — prefill the rest of the form */
  onPick: (rec: ComboRec) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Requirement-matching kind first, then unused before already-added.
  const sorted = [...options].sort((a, b) => {
    const ak = a.kind === preferKind ? 0 : 1;
    const bk = b.kind === preferKind ? 0 : 1;
    if (ak !== bk) return ak - bk;
    const au = usedNames.has((a.name ?? "").trim().toLowerCase()) ? 1 : 0;
    const bu = usedNames.has((b.name ?? "").trim().toLowerCase()) ? 1 : 0;
    return au - bu;
  });
  const q = value.trim().toLowerCase();
  const filtered = q ? sorted.filter((r) => (r.name ?? "").toLowerCase().includes(q)) : sorted;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        className="input mt-1 pr-9"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onType(e.target.value); setOpen(true); setActiveIdx(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) { setOpen(true); return; }
            setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && activeIdx >= 0 && filtered[activeIdx]) {
            e.preventDefault();
            onPick(filtered[activeIdx]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {/* caret affordance */}
      {options.length > 0 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close suggestions" : "Show suggestions"}
          onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
          className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 text-text-muted hover:text-text-secondary"
        >
          <svg className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}

      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border-default bg-surface-card py-1 shadow-lg"
        >
          {filtered.map((r, i) => {
            const used = usedNames.has((r.name ?? "").trim().toLowerCase());
            const meta = [r.title, r.institution].filter(Boolean).join(" · ");
            return (
              <li
                key={`${r.name}-${i}`}
                role="option"
                aria-selected={i === activeIdx}
                onMouseDown={(e) => { e.preventDefault(); onPick(r); setOpen(false); }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`cursor-pointer px-3 py-2 ${i === activeIdx ? "bg-surface-muted" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">{r.name}</span>
                  {r.kind && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                      r.kind === "independent" ? "bg-success-soft text-success-text" : "bg-info-soft text-info-text"
                    }`}>
                      {r.kind}
                    </span>
                  )}
                  {used && (
                    <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted">already added</span>
                  )}
                </div>
                {meta && <div className="truncate text-xs text-text-muted">{meta}</div>}
                {r.relationship && <div className="truncate text-[11px] text-text-muted">{r.relationship}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
