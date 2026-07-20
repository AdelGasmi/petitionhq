"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Case } from "@/lib/db";

type Props = {
  caseId: string;
  reviewStatus: Case["reviewStatus"];
  reviewNote: Case["reviewNote"];
  currentUserRole: "admin" | "attorney" | "applicant";
  hasAttorney: boolean;
};

export function ReviewRequestPanel({
  caseId,
  reviewStatus,
  reviewNote,
  currentUserRole,
  hasAttorney,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [showDeclineNote, setShowDeclineNote] = useState(false);

  const request = async () => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/cases/${caseId}/review-request`, { method: "POST" });
    const data = await res.json();
    if (res.ok) router.refresh();
    else setError(data.error || "Failed");
    setBusy(false);
  };

  const respond = async (response: "accepted" | "declined") => {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/cases/${caseId}/review-request`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response, note: note.trim() || undefined }),
    });
    const data = await res.json();
    if (res.ok) router.refresh();
    else setError(data.error || "Failed");
    setBusy(false);
  };

  // ── Applicant side ─────────────────────────────────────────────────────────

  if (currentUserRole === "applicant") {
    if (!hasAttorney) return null;

    if (!reviewStatus || reviewStatus === "declined") {
      return (
        <div className="card flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Ready for attorney review?</p>
            {reviewStatus === "declined" && (
              <p className="mt-0.5 text-xs text-stone-500">
                Previous request declined
                {reviewNote ? `: "${reviewNote}"` : ""}. You can request again.
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn-primary shrink-0"
            onClick={request}
            disabled={busy}
          >
            {busy ? "Sending..." : "Request review"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );
    }

    if (reviewStatus === "pending") {
      return (
        <div className="card flex items-center gap-3">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <p className="text-sm text-stone-700">
            Review request sent — waiting for your attorney.
          </p>
        </div>
      );
    }

    if (reviewStatus === "accepted") {
      return (
        <div className="card flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          <p className="text-sm text-stone-700">
            Attorney accepted your review request. Case is now under review.
          </p>
        </div>
      );
    }

    return null;
  }

  // ── Attorney side ──────────────────────────────────────────────────────────

  if (reviewStatus !== "pending") return null;

  return (
    <div className="card space-y-3 border-amber-200 bg-amber-50">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" />
        <div>
          <p className="text-sm font-medium text-amber-900">Review requested</p>
          <p className="mt-0.5 text-xs text-amber-700">
            The applicant is asking you to review this case.
          </p>
        </div>
      </div>

      {showDeclineNote ? (
        <div className="space-y-2">
          <textarea
            className="input text-sm"
            rows={2}
            placeholder="Reason for declining (optional)..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => respond("declined")}
              disabled={busy}
            >
              {busy ? "..." : "Confirm decline"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowDeclineNote(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => respond("accepted")}
            disabled={busy}
          >
            {busy ? "..." : "Accept"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowDeclineNote(true)}
            disabled={busy}
          >
            Decline
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
