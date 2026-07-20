"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * Attorney platform-terms acceptance gate. Rendered by the /network layout
 * (server-enforced) for any attorney whose acceptance is missing or stale
 * (version bump). Mirrors the BetaAgreementGate pattern. The terms content
 * itself is server-rendered by the layout and passed in as children so the
 * accepted text is exactly the canonical AttorneyTermsContent.
 */
export function AttorneyTermsGate({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/attorney-terms", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="card space-y-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Attorney onboarding
          </div>
          <h1 className="mt-1 font-serif text-2xl tracking-tight">Attorney Platform Terms</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Before you can browse candidates, claim leads, or use the drafting workspace, please
            review and accept the terms below. They also live at{" "}
            <Link href="/attorney-terms" target="_blank" className="text-text-primary underline hover:no-underline">
              /attorney-terms
            </Link>{" "}
            for your records.
          </p>
        </div>

        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border-default bg-surface-subtle p-5">
          {children}
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border-default"
          />
          <span className="text-text-secondary">
            I am a licensed attorney (or authorized to act for one), I have read the Attorney
            Platform Terms, and I accept them on behalf of myself and my firm.
          </span>
        </label>

        {error && <p className="text-sm text-danger-text">{error}</p>}

        <button
          onClick={handleAccept}
          disabled={!checked || loading}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {loading ? "…" : "Accept and continue"}
        </button>
      </div>
    </div>
  );
}
