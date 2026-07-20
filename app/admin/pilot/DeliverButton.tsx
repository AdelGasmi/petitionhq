"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeliverButton({ leadId, alreadyDelivered }: { leadId: string; alreadyDelivered: boolean }) {
  const [open, setOpen] = useState(false);
  const [firm, setFirm] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (alreadyDelivered) {
    return <span className="text-xs text-success-text font-medium">Delivered ✓</span>;
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-primary text-xs py-1">
        Deliver to firm →
      </button>
    );
  }

  const handleDeliver = async () => {
    if (!firm.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pilotFirm: firm }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        alert(err.error ?? "Delivery failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={firm}
        onChange={(e) => setFirm(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleDeliver(); if (e.key === "Escape") setOpen(false); }}
        placeholder="Firm name…"
        className="text-xs border border-border-default rounded px-2 py-1 w-32 bg-surface-card"
      />
      <button onClick={handleDeliver} disabled={loading || !firm.trim()} className="btn btn-primary text-xs py-1 disabled:opacity-50">
        {loading ? "…" : "Go"}
      </button>
      <button onClick={() => setOpen(false)} className="text-xs text-text-muted hover:text-text-primary">✕</button>
    </div>
  );
}
