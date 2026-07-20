"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BetaDeactivateButton({ userId, className = "btn btn-danger text-xs" }: { userId: string; className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const deactivate = async () => {
    if (!window.confirm("End this user's self-petitioner beta trial? They'll immediately lose drafting access on their case; the account and case stay intact.")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/beta-deactivate`, { method: "POST" });
      if (res.ok) {
        setDone(true);
        router.refresh();
      } else {
        alert("Failed to deactivate.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) return <span className="text-xs font-medium text-success-text">Deactivated ✓</span>;

  return (
    <button type="button" className={className} onClick={deactivate} disabled={loading}>
      {loading ? "…" : "Deactivate beta"}
    </button>
  );
}
