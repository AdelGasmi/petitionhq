"use client";

import { useState } from "react";

type Props = {
  caseId: string;
};

export function GuestLinkPanel({ caseId }: Props) {
  const [url, setUrl] = useState("");
  const [expiry, setExpiry] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState(false);

  async function generate() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/guest-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed"); return; }
      setUrl(data.url);
      setExpiry(data.expiry);
    } finally { setLoading(false); }
  }

  async function revoke() {
    setRevoking(true); setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/guest-link`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); setError(d.error ?? "Failed"); return; }
      setUrl(""); setExpiry("");
    } finally { setRevoking(false); }
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Guest reviewer link</p>
          <p className="mt-0.5 text-xs text-stone-500">
            Share with an attorney or reviewer. No account needed — the link grants full access to this case.
          </p>
        </div>
      </div>

      {url ? (
        <div className="space-y-2">
          <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
            <p className="break-all font-mono text-xs text-stone-700">{url}</p>
            {expiry && (
              <p className="mt-1 text-xs text-stone-400">
                Expires {new Date(expiry).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={copy} className="btn btn-primary text-xs">
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button onClick={generate} disabled={loading} className="btn btn-secondary text-xs">
              {loading ? "..." : "Regenerate"}
            </button>
            <button onClick={revoke} disabled={revoking} className="btn btn-secondary text-xs text-red-600 hover:text-red-800">
              {revoking ? "..." : "Revoke"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={generate} disabled={loading} className="btn btn-secondary text-sm">
          {loading ? "Generating…" : "Generate guest link"}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
