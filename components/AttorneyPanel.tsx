"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

type Attorney = { id: string; name: string; email: string };

type Props = {
  caseId: string;
  currentUserId: string;
  currentUserRole: "admin" | "attorney" | "applicant";
  assignedAttorneyId?: string;
  assignedAttorneyName?: string;
};

export function AttorneyPanel({
  caseId,
  currentUserId,
  currentUserRole,
  assignedAttorneyId,
  assignedAttorneyName,
}: Props) {
  const router = useRouter();
  const [attorneys, setAttorneys] = useState<Attorney[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = currentUserRole === "admin";
  const isAttorney = currentUserRole === "attorney";

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/attorneys")
      .then((r) => r.json())
      .then((list: Attorney[]) => {
        setAttorneys(list);
        if (list.length > 0) setSelectedId(list[0].id);
      })
      .catch(() => {});
  }, [isAdmin]);

  const assign = async (id?: string) => {
    const targetId = id ?? selectedId;
    if (!targetId) return;
    setBusy(true); setError("");
    const res = await fetch(`/api/cases/${caseId}/attorney`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attorneyId: targetId }),
    });
    const data = await res.json();
    if (res.ok) { setReassigning(false); router.refresh(); }
    else setError(data.error || "Failed to assign attorney");
    setBusy(false);
  };

  const removeAttorney = async () => {
    setBusy(true); setError("");
    const res = await fetch(`/api/cases/${caseId}/attorney`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else setError("Failed");
    setBusy(false);
  };

  // ── Applicant view — no controls, just status ────────────────────────────

  if (currentUserRole === "applicant") {
    return (
      <div className="card">
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Attorney</p>
        {assignedAttorneyId ? (
          <p className="mt-1 font-medium">{assignedAttorneyName || assignedAttorneyId}</p>
        ) : (
          <p className="mt-1 text-sm text-stone-500">
            An attorney will be assigned to your case — you&apos;ll be notified once one is confirmed.
          </p>
        )}
      </div>
    );
  }

  // ── Attorney view: show status, offer "Claim case" if unassigned ─────────

  if (isAttorney) {
    if (assignedAttorneyId) {
      const isMe = assignedAttorneyId === currentUserId;
      return (
        <div className="card flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Attorney</p>
            <p className="mt-0.5 font-medium">
              {isMe ? "You" : (assignedAttorneyName || assignedAttorneyId)}
            </p>
          </div>
          {isMe && (
            <button
              type="button"
              className="text-xs text-red-600 hover:text-red-800"
              onClick={removeAttorney}
              disabled={busy}
            >
              Unassign myself
            </button>
          )}
        </div>
      );
    }
    return (
      <div className="card space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Attorney</p>
          <p className="mt-0.5 text-sm text-stone-500">No attorney assigned yet.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => assign(currentUserId)}
          disabled={busy}
        >
          {busy ? "Claiming…" : "Claim this case"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  // ── Admin view: assign dropdown, reassign, remove ────────────────────────

  if (assignedAttorneyId) {
    if (reassigning) {
      return (
        <div className="card space-y-3">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Reassign attorney</p>
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {attorneys.length === 0 && <option value="">No attorneys on platform</option>}
              {attorneys.map((a) => (
                <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary shrink-0"
              onClick={() => assign()}
              disabled={busy || !selectedId || selectedId === assignedAttorneyId}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
            <button
              type="button"
              className="btn btn-secondary shrink-0"
              onClick={() => { setReassigning(false); setError(""); }}
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      );
    }

    return (
      <div className="card flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Attorney</p>
          <p className="mt-0.5 font-medium">{assignedAttorneyName || assignedAttorneyId}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            className="text-xs text-stone-500 hover:text-stone-900"
            onClick={() => setReassigning(true)}
          >
            Reassign
          </button>
          <button
            type="button"
            className="text-xs text-red-600 hover:text-red-800"
            onClick={removeAttorney}
            disabled={busy}
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Attorney</p>
        <p className="mt-0.5 text-sm text-stone-500">No attorney assigned yet.</p>
      </div>
      <div className="flex gap-2">
        <select
          className="input flex-1"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {attorneys.length === 0 && <option value="">No attorneys on platform</option>}
          {attorneys.map((a) => (
            <option key={a.id} value={a.id}>{a.name} — {a.email}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary shrink-0"
          onClick={() => assign()}
          disabled={busy || !selectedId}
        >
          {busy ? "Assigning…" : "Assign"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
