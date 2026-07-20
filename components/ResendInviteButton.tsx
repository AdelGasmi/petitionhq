"use client";

import { useState } from "react";

export function ResendInviteButton({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name: string;
}) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const resend = async () => {
    setState("sending");
    setError("");
    const res = await fetch("/api/admin/invite-user/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (res.ok) {
      setState("sent");
    } else {
      setState("error");
      setError(data.error ?? "Failed to resend invite.");
    }
  };

  if (state === "sent") {
    return <p className="text-sm text-green-700">Invite resent to {email}.</p>;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        className="btn btn-secondary text-sm"
        onClick={resend}
        disabled={state === "sending"}
      >
        {state === "sending" ? "Sending…" : "Resend invite email"}
      </button>
      {state === "error" && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
