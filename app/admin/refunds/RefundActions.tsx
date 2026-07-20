"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  refundId: string;
  caseId: string;
};

export function RefundActions({ refundId, caseId }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDeny, setShowDeny] = useState(false);

  async function handleAction(action: "approve" | "deny") {
    setLoading(action);
    setError(null);

    try {
      const res = await fetch(`/api/admin/refunds/${refundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes: notes || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? `Failed to ${action} refund`);
        return;
      }

      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="border-t border-border-subtle pt-3 space-y-3">
      {showDeny && (
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1">
            Denial reason (optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Explain why the refund is denied…"
            className="w-full rounded-lg border border-border-default px-3 py-2 text-sm resize-none focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2">
          <p className="text-sm text-danger-text">{error}</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleAction("approve")}
          disabled={loading !== null}
          className="btn btn-primary text-sm"
        >
          {loading === "approve" ? "Processing…" : "Approve & refund"}
        </button>
        {!showDeny ? (
          <button
            onClick={() => setShowDeny(true)}
            disabled={loading !== null}
            className="btn btn-ghost text-sm text-danger-fill"
          >
            Deny
          </button>
        ) : (
          <button
            onClick={() => handleAction("deny")}
            disabled={loading !== null}
            className="btn btn-danger text-sm"
          >
            {loading === "deny" ? "Denying…" : "Confirm deny"}
          </button>
        )}
      </div>
    </div>
  );
}
