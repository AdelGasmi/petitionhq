"use client";

import { useState } from "react";

export function NotifyButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);

  const handleNotify = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/notify`, { method: "POST" });
      const data = (await res.json()) as { sent: number; failed: number };
      setResult(data);
    } catch {
      setResult({ sent: 0, failed: 1 });
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <p className="text-xs text-text-muted">
        Notified {result.sent} attorney{result.sent !== 1 ? "s" : ""}{result.failed > 0 ? ` (${result.failed} failed)` : ""}
      </p>
    );
  }

  return (
    <button onClick={handleNotify} disabled={loading} className="btn btn-secondary text-sm">
      {loading ? "Notifying…" : "Notify network"}
    </button>
  );
}
