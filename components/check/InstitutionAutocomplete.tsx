"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Hit = { id: string; name: string; acronym?: string; country: string; type: string };

/**
 * ROR-backed institution typeahead. The applicant picks a canonical
 * organization and we capture both the display name and its ROR ID, so
 * verification resolves the exact org instead of fuzzy-matching a typed
 * string. Falls back to plain free text (rorId = "") when nothing is picked,
 * so coverage never regresses and the funnel never stalls on a slow lookup.
 */
export function InstitutionAutocomplete({
  value,
  rorId,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  rorId: string;
  onChange: (name: string, rorId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Suppresses the search-on-type effect right after a selection.
  const justPicked = useRef(false);

  const runSearch = useCallback((q: string) => {
    if (q.trim().length < 2) { setHits([]); setOpen(false); return; }
    setLoading(true);
    fetch(`/api/institutions/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d: { results?: Hit[] }) => {
        setHits(d.results ?? []);
        setOpen((d.results ?? []).length > 0);
        setActive(-1);
      })
      .catch(() => { setHits([]); setOpen(false); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (justPicked.current) { justPicked.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, runSearch]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (hit: Hit) => {
    justPicked.current = true;
    onChange(hit.name, hit.id);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && active >= 0) { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        type="text"
        className="input text-sm"
        placeholder={placeholder ?? "Start typing your university or institution"}
        value={value}
        disabled={disabled}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value, "")}
        onFocus={() => { if (hits.length > 0 && !rorId) setOpen(true); }}
        onKeyDown={onKeyDown}
      />

      {!rorId && value.trim().length >= 2 && !loading && !open ? (
        <p className="mt-1 text-xs text-text-muted">
          We&apos;ll use what you typed. Pick from the list when it appears for the most accurate match.
        </p>
      ) : null}

      {open && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border-default bg-surface-card shadow-lg">
          {hits.map((hit, i) => (
            <li key={hit.id}>
              <button
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left text-sm hover:bg-surface-canvas ${i === active ? "bg-surface-canvas" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(hit)}
              >
                <span className="text-text-primary">
                  {hit.name}
                  {hit.acronym && hit.acronym.toLowerCase() !== hit.name.toLowerCase() && (
                    <span className="text-text-muted"> ({hit.acronym})</span>
                  )}
                </span>
                <span className="text-xs text-text-muted">{hit.country}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
