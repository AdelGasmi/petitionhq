"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BetaReverseButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const post = async (force: boolean) => {
    const res = await fetch(`/api/admin/leads/${leadId}/beta-reverse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force }),
    });
    return res;
  };

  const handleReverse = async () => {
    if (
      !window.confirm(
        "Reverse this beta invite and return the lead to the pool?\n\n" +
          "If they never started, their throwaway beta account + case are deleted and the lead becomes a normal, re-invitable lead again. " +
          "No email is sent.",
      )
    )
      return;

    setLoading(true);
    try {
      let res = await post(false);

      // 409 + needsForce: they've already started working — offer to wipe.
      if (res.status === 409) {
        const err = (await res.json()) as { error?: string; needsForce?: boolean };
        if (err.needsForce) {
          if (!window.confirm(`${err.error}\n\nForce-reverse and permanently delete their beta work?`)) return;
          res = await post(true);
        } else {
          alert(err.error ?? "Reverse failed");
          return;
        }
      }

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        alert(err.error ?? "Reverse failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleReverse}
      disabled={loading}
      className="btn btn-ghost text-xs py-1 text-danger-text disabled:opacity-50"
      title="End the beta and return this lead to the pool"
    >
      {loading ? "…" : "Reverse"}
    </button>
  );
}
