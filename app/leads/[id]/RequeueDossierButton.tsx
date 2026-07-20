"use client";

import { useState } from "react";

export function RequeueDossierButton({ leadId }: { leadId: string }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const requeue = async () => {
    if (!confirm("Re-queue this dossier? The next cron run will attempt to regenerate it.")) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/requeue-dossier`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Error: ${data.error}`);
      } else {
        setResult("Re-queued");
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
    <button
      onClick={requeue}
      disabled={busy}
      className="rounded bg-warning-bg px-3 py-1 text-xs font-medium text-warning-text hover:bg-warning-soft border border-warning-border disabled:opacity-50"
    >
      {busy ? "…" : "Re-queue dossier"}
    </button>
  );
}
