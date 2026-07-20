"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BetaConvertButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleConvert = async () => {
    if (
      !window.confirm(
        "Invite this lead to the free self-petitioner beta?\n\n" +
          "This creates their beta account + case and sends ONE invitation email to set up their password. " +
          "The email is framed as document-preparation software — not legal advice, and NOT an attorney accepting their case. " +
          "They will not be emailed again.",
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/beta-convert`, { method: "POST" });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        alert(err.error ?? "Beta invite failed");
        return;
      }
      // 200 with ok:false = account created but the invite email failed to send.
      // Surface it so the admin can resend manually (we never auto-re-invite).
      const data = (await res.json()) as { ok?: boolean; warning?: string };
      if (data.ok === false && data.warning) alert(data.warning);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleConvert} disabled={loading} className="btn btn-secondary text-xs py-1 disabled:opacity-50">
      {loading ? "…" : "Invite to beta →"}
    </button>
  );
}
