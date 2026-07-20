"use client";

import { useState } from "react";

export function ReleaseButton({ leadId, hasPayment }: { leadId: string; hasPayment: boolean }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const release = async (withRefund: boolean) => {
    const msg = withRefund
      ? "Release this lead AND issue a Stripe refund? This cannot be undone."
      : "Release this lead back to the open pool? No refund will be issued.";
    if (!confirm(msg)) return;

    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refund: withRefund, reason: "Admin release" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult(withRefund ? "Released + refunded" : "Released");
        // Reload after a moment so the page reflects the new state
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch {
      setResult("Network error");
    }
    setBusy(false);
  };

  if (result) {
    return (
      <span className={`text-xs font-medium ${result.startsWith("Error") ? "text-danger-fill" : "text-success-text"}`}>
        {result}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => release(false)}
        disabled={busy}
        className="rounded bg-surface-muted px-3 py-1 text-xs font-medium text-text-secondary hover:bg-surface-muted disabled:opacity-50"
      >
        {busy ? "…" : "Release"}
      </button>
      {hasPayment && (
        <button
          onClick={() => release(true)}
          disabled={busy}
          className="rounded bg-danger-bg px-3 py-1 text-xs font-medium text-danger-text hover:bg-danger-soft disabled:opacity-50"
        >
          {busy ? "…" : "Refund + release"}
        </button>
      )}
    </div>
  );
}
