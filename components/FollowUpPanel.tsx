"use client";

import { useState } from "react";

type Props = {
  caseId: string;
  initialFollowUp?: string;
  initialAction?: string;
};

const QUICK_ACTIONS = [
  "Follow up with applicant on missing documents",
  "Review uploaded evidence",
  "Draft recommendation letters",
  "Schedule consultation call",
  "Send petition for applicant review",
  "Prepare filing package",
];

export function FollowUpPanel({ caseId, initialFollowUp, initialAction }: Props) {
  const [followUp, setFollowUp] = useState(initialFollowUp?.slice(0, 10) ?? "");
  const [action, setAction] = useState(initialAction ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isOverdue = followUp && new Date(followUp) < new Date(new Date().toDateString());
  const isDueSoon = followUp && !isOverdue && new Date(followUp) <= new Date(Date.now() + 2 * 86400000);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetch(`/api/cases/${caseId}/follow-up`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nextFollowUp: followUp || null,
          nextAction: action.trim() || null,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* best-effort */ }
    finally { setSaving(false); }
  };

  const handleClear = async () => {
    setFollowUp("");
    setAction("");
    setSaving(true);
    try {
      await fetch(`/api/cases/${caseId}/follow-up`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nextFollowUp: null, nextAction: null }),
      });
    } catch { /* best-effort */ }
    finally { setSaving(false); }
  };

  return (
    <div className={`card space-y-3 ${isOverdue ? "border-red-200 bg-red-50/50" : isDueSoon ? "border-amber-200 bg-amber-50/50" : ""}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Next follow-up</h3>
        {isOverdue && (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">
            Overdue
          </span>
        )}
        {isDueSoon && !isOverdue && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
            Due soon
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          className="input text-sm flex-shrink-0"
          style={{ width: "160px" }}
          value={followUp}
          onChange={(e) => setFollowUp(e.target.value)}
        />
        <input
          type="text"
          className="input text-sm flex-1"
          placeholder="Next action..."
          value={action}
          onChange={(e) => setAction(e.target.value)}
        />
      </div>

      {/* Quick action chips */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_ACTIONS.map((qa) => (
          <button
            key={qa}
            type="button"
            className={`rounded-full px-2.5 py-1 text-xs transition ${
              action === qa
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
            onClick={() => setAction(action === qa ? "" : qa)}
          >
            {qa}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-primary text-xs px-4"
          disabled={saving || (!followUp && !action.trim())}
          onClick={handleSave}
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Set follow-up"}
        </button>
        {(initialFollowUp || initialAction) && (
          <button
            type="button"
            className="btn btn-ghost text-xs"
            onClick={handleClear}
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
