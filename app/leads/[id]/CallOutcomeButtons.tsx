"use client";

import React, { useState } from "react";

const OUTCOMES = [
  { value: "scheduled", label: "Call scheduled", icon: "cal", style: "bg-info-bg border-info-border text-info-text" },
  { value: "retained", label: "Client retained", icon: "check", style: "bg-success-bg border-success-border text-success-text" },
  { value: "passed", label: "Passed", icon: "dash", style: "bg-surface-subtle border-border-default text-text-secondary" },
] as const;

const ICON_MAP: Record<string, React.ReactNode> = {
  cal: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="inline h-3.5 w-3.5"><path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" /></svg>,
  check: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="inline h-3.5 w-3.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>,
  dash: <span className="inline-block w-3 text-center">—</span>,
};

const OUTCOME_DISPLAY: Record<string, { label: string; icon: string; style: string }> = {
  scheduled: { label: "Call scheduled", icon: "cal", style: "bg-info-bg border-info-border text-info-text" },
  retained: { label: "Client retained", icon: "check", style: "bg-success-bg border-success-border text-success-text" },
  passed: { label: "Passed", icon: "dash", style: "bg-surface-muted border-border-default text-text-secondary" },
};

export function CallOutcomeButtons({ leadId, initial }: { leadId: string; initial: string | null }) {
  const [outcome, setOutcome] = useState(initial);
  const [saving, setSaving] = useState(false);

  const save = async (value: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callOutcome: value }),
      });
      if (res.ok) setOutcome(value);
    } catch { /* best-effort */ }
    finally { setSaving(false); }
  };

  if (outcome) {
    const d = OUTCOME_DISPLAY[outcome];
    return (
      <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${d?.style ?? "bg-surface-subtle"}`}>
        {d?.icon && ICON_MAP[d.icon]}{d?.label ?? outcome}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-card px-5 py-4 space-y-3">
      <p className="text-sm font-medium text-text-secondary">Log call outcome</p>
      <div className="flex gap-2">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            onClick={() => save(o.value)}
            disabled={saving}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition hover:shadow-sm disabled:opacity-50 ${o.style}`}
          >
            {ICON_MAP[o.icon]} {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
