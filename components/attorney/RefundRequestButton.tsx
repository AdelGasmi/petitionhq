"use client";

import { useState } from "react";

const REASONS = [
  { value: "material_misrepresentation", label: "Material misrepresentation" },
  { value: "applicant_ghost", label: "Applicant unresponsive" },
  { value: "other", label: "Other" },
] as const;

type Props = {
  caseId: string;
};

export function RefundRequestButton({ caseId }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [explanation, setExplanation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(`/api/cases/${caseId}/refund-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, explanation }),
      });

      const data = await res.json();

      if (res.ok) {
        setResult({ ok: true, message: "Refund request submitted. Admin will review shortly." });
        setOpen(false);
      } else {
        setResult({ ok: false, message: data.error ?? "Failed to submit refund request" });
      }
    } catch {
      setResult({ ok: false, message: "Network error. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  // Already submitted successfully
  if (result?.ok) {
    return (
      <div className="rounded-lg border border-success-border bg-success-bg px-4 py-3">
        <p className="text-sm font-medium text-success-text">{result.message}</p>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-text-muted underline hover:text-text-secondary"
      >
        Need a refund? Request one here
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border-default bg-surface-card shadow-xl">
            <div className="border-b border-border-subtle px-6 py-4">
              <h2 className="font-serif text-lg text-text-primary">Request Refund</h2>
              <p className="mt-1 text-xs text-text-muted">
                Submit a refund request for this case. An admin will review and decide.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:border-border-strong focus:ring-1 focus:ring-border-strong"
                >
                  <option value="">Select a reason…</option>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  Explanation
                </label>
                <textarea
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  required
                  minLength={10}
                  rows={4}
                  placeholder="Describe what was misrepresented and the evidence you found…"
                  className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:border-border-strong focus:ring-1 focus:ring-border-strong resize-none"
                />
                <p className="mt-1 text-xs text-text-muted">Minimum 10 characters</p>
              </div>

              {result && !result.ok && (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2">
                  <p className="text-sm text-danger-text">{result.message}</p>
                </div>
              )}

              <div className="flex justify-end gap-3 border-t border-border-subtle pt-4">
                <button
                  type="button"
                  onClick={() => { setOpen(false); setResult(null); }}
                  className="btn btn-ghost text-sm"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !reason || explanation.length < 10}
                  className="btn btn-danger text-sm"
                >
                  {submitting ? "Submitting…" : "Submit refund request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
