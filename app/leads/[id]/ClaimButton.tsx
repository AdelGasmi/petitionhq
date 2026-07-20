"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";

export function ClaimButton({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleConfirm = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${leadId}/claim`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean; checkoutUrl?: string; status?: string; error?: string };
      if (!res.ok) {
        if (res.status === 402) setError("Active subscription required to claim leads.");
        else if (res.status === 409) setError("This case was just claimed by another attorney.");
        else setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setShowConfirm(false);
        router.refresh();
      }
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn btn-primary text-sm"
      >
        Claim — $150
      </button>

      <Modal
        open={showConfirm}
        onClose={() => { if (!loading) setShowConfirm(false); }}
        title="Claim this lead?"
        dismissable={!loading}
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Claiming unlocks the full 8-page dossier, applicant contact details, exhibit plan, and AI-drafted brief sections for this lead.
          </p>

          <div className="rounded-lg bg-surface-subtle border border-border-default px-4 py-3 space-y-1.5 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-success-text mt-0.5">✓</span>
              <span className="text-text-secondary">$150 charged on claim</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-success-text mt-0.5">✓</span>
              <span className="text-text-secondary">Auto-refunded if the applicant doesn&apos;t complete intake in <strong>14 days</strong> — no paperwork</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-success-text mt-0.5">✓</span>
              <span className="text-text-secondary">Refundable within 30 days for material misrepresentation</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-success-text mt-0.5">✓</span>
              <span className="text-text-secondary">Applicants never pay us a referral fee</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-danger-fill">{error}</p>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="btn btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              data-loading={loading ? "true" : undefined}
              className="btn btn-primary text-sm"
            >
              {loading ? "Processing…" : "Confirm claim"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
