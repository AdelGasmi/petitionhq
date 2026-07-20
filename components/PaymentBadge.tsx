"use client";

import { useState, useRef, useEffect } from "react";

type PaymentStatus = "unpaid" | "invoiced" | "paid";

const STATUS_STYLE: Record<PaymentStatus, string> = {
  unpaid:   "bg-red-100 text-red-700",
  invoiced: "bg-amber-100 text-amber-800",
  paid:     "bg-green-100 text-green-700",
};

const STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid:   "Unpaid",
  invoiced: "Invoiced",
  paid:     "Paid",
};

export function PaymentBadge({
  caseId,
  initialStatus,
  initialNotes,
}: {
  caseId: string;
  initialStatus: PaymentStatus;
  initialNotes?: string;
}) {
  const [status, setStatus] = useState<PaymentStatus>(initialStatus);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<PaymentStatus>(initialStatus);
  const [draftNotes, setDraftNotes] = useState(initialNotes ?? "");
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openPanel = () => {
    setDraft(status);
    setDraftNotes(notes);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}/payment`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentStatus: draft, paymentNotes: draftNotes }),
    });
    setSaving(false);
    if (res.ok) {
      setStatus(draft);
      setNotes(draftNotes);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={openPanel}
        className={`rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-75 ${STATUS_STYLE[status]}`}
        title="Click to update payment status"
      >
        {STATUS_LABEL[status]}
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-20 w-64 rounded-xl border border-stone-200 bg-surface-card p-4 shadow-xl space-y-3">
          <div className="text-xs font-medium text-stone-500 uppercase tracking-wide">Payment status</div>

          <div className="flex gap-2">
            {(["unpaid", "invoiced", "paid"] as PaymentStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft(s)}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                  draft === s
                    ? `${STATUS_STYLE[s]} border-transparent`
                    : "border-stone-200 text-stone-500 hover:border-stone-400"
                }`}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-stone-500 mb-1">Notes (optional)</label>
            <textarea
              className="input text-xs min-h-[60px] resize-none"
              placeholder="Invoice #, amount, date…"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary flex-1 py-1.5 text-xs"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-secondary py-1.5 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
