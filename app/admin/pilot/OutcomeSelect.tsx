"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const OUTCOMES = [
  { value: "delivered", label: "Delivered" },
  { value: "consult_booked", label: "Consult booked" },
  { value: "signed", label: "Signed" },
  { value: "rejected_junk", label: "Rejected (junk)" },
] as const;

type OutcomeStatus = typeof OUTCOMES[number]["value"];

export function OutcomeSelect({
  leadId,
  outcomeId,
  current,
}: {
  leadId: string;
  outcomeId: string;
  current: OutcomeStatus;
}) {
  const [status, setStatus] = useState<OutcomeStatus>(current);
  const [reason, setReason] = useState("");
  const [revenue, setRevenue] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = async (newStatus: OutcomeStatus) => {
    if (newStatus === status) return;
    setStatus(newStatus);
    setLoading(true);
    try {
      const revCents = revenue ? Math.round(parseFloat(revenue) * 100) : undefined;
      await fetch(`/api/admin/leads/${leadId}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          outcomeId,
          status: newStatus,
          ...(reason ? { reason } : {}),
          ...(revCents ? { revenueCents: revCents } : {}),
        }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select
        value={status}
        disabled={loading}
        onChange={(e) => handleChange(e.target.value as OutcomeStatus)}
        className="text-xs border border-border-default rounded px-2 py-1 bg-surface-card"
      >
        {OUTCOMES.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {status === "rejected_junk" && (
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => reason && handleChange(status)}
          placeholder="Reason…"
          className="text-xs border border-border-default rounded px-2 py-1 w-28 bg-surface-card"
        />
      )}
      {status === "signed" && (
        <input
          value={revenue}
          onChange={(e) => setRevenue(e.target.value)}
          onBlur={() => revenue && handleChange(status)}
          placeholder="Revenue $"
          type="number"
          min="0"
          className="text-xs border border-border-default rounded px-2 py-1 w-24 bg-surface-card"
        />
      )}
    </div>
  );
}
