"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem = { id: string; label: string };

type Props = {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Optional content pinned to the right of the tab row (e.g. a save-state indicator). */
  trailing?: ReactNode;
  ariaLabel?: string;
};

/**
 * Accessible tab bar (DESIGN.md §3.11). `role="tablist"` with roving tabindex
 * and arrow-key navigation (activation follows focus). The tablist scrolls
 * horizontally (`overflow-x-auto whitespace-nowrap`) so 5+ tabs never clip or
 * wrap on phones. URL sync (`?tab=`) is owned by the consumer via `onChange`.
 */
export function Tabs({ tabs, value, onChange, trailing, ariaLabel }: Props) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    onChange(tabs[next].id);
    btnRefs.current[next]?.focus();
  }

  return (
    <div className="flex items-center border-b border-border-default">
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex flex-1 gap-1 overflow-x-auto whitespace-nowrap"
      >
        {tabs.map((t, i) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              ref={(el) => {
                btnRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`shrink-0 px-4 py-2 text-sm font-medium transition ${
                active
                  ? "border-b-2 border-brand-primary text-text-primary"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {trailing && <div className="shrink-0 pl-2">{trailing}</div>}
    </div>
  );
}
