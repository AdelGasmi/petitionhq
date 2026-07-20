"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function BetaAgreementGate() {
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleAccept = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/beta-agreement", { method: "POST" });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
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
    <div className="mx-auto max-w-2xl">
      <div className="card space-y-5">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-text-muted">Self-petitioner beta</div>
          <h1 className="mt-1 font-serif text-2xl tracking-tight">Before you get started</h1>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-text-secondary">
          <p>
            You've been invited into a free beta of PetitionHQ's document-preparation software. Please read
            and accept the following before continuing:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li><strong className="text-text-primary">PetitionHQ is not a law firm.</strong> Nothing you see here is legal advice.</li>
            <li>Using this software does not create an attorney-client relationship, and no attorney reviews your individual case.</li>
            <li>We do not guarantee any filing outcome. USCIS approval is entirely at USCIS's discretion.</li>
            <li>You are solely responsible for what you ultimately file with USCIS, and we recommend consulting a licensed immigration attorney.</li>
            <li>This beta is free — we do not charge self-petitioners for use of the software.</li>
            <li>We may use your data (in accordance with our Privacy Policy) to operate and improve the beta.</li>
          </ul>
          <p>
            Full terms are in our{" "}
            <Link href="/terms" target="_blank" className="text-text-primary underline hover:no-underline">
              Terms of Service
            </Link>.
          </p>
        </div>

        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border-default"
          />
          <span className="text-text-secondary">
            I understand and agree to the above, and I accept the Terms of Service.
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
