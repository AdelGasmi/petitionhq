"use client";

import { useState } from "react";
import type { SectionComment } from "@/lib/db";

type Props = {
  caseId: string;
  sectionId: string;
  initialComments: SectionComment[];
  currentUserId: string;
  currentUserRole: "admin" | "attorney" | "applicant";
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function SectionComments({
  caseId,
  sectionId,
  initialComments,
  currentUserId,
  currentUserRole,
}: Props) {
  const [comments, setComments] = useState<SectionComment[]>(initialComments);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const active = comments.filter((c) => !c.resolved);
  const resolved = comments.filter((c) => c.resolved);

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionId, text }),
    });
    if (res.ok) {
      const comment: SectionComment = await res.json();
      setComments((prev) => [...prev, comment]);
      setText("");
    }
    setPosting(false);
  };

  const resolve = async (commentId: string) => {
    const res = await fetch(`/api/cases/${caseId}/comments/${commentId}`, {
      method: "PATCH",
    });
    if (res.ok) {
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
      );
    }
  };

  const remove = async (commentId: string) => {
    const res = await fetch(`/api/cases/${caseId}/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const unreadFromOther = active.filter((c) => c.authorId !== currentUserId).length;

  return (
    <div className="mt-1">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition ${
          unreadFromOther > 0
            ? "bg-warning-soft text-warning-text hover:bg-warning-border"
            : active.length > 0
            ? "bg-surface-muted text-text-secondary hover:bg-surface-muted"
            : "text-text-muted hover:bg-surface-muted hover:text-text-secondary"
        }`}
      >
        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5l-3 3V4z" />
        </svg>
        {active.length > 0
          ? `${active.length} comment${active.length > 1 ? "s" : ""}${unreadFromOther > 0 ? ` · ${unreadFromOther} new` : ""}`
          : "Add comment"}
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border-default bg-surface-subtle p-3 space-y-3">
          {/* Active comments */}
          {active.length > 0 && (
            <div className="space-y-2">
              {active.map((c) => (
                <div key={c.id} className="space-y-1">
                  <div className="flex items-center gap-2 text-xs text-text-muted">
                    <span className="font-medium text-text-secondary">{c.authorName}</span>
                    <span className={`badge badge-role-${c.authorRole}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                      {c.authorRole}
                    </span>
                    <span>{timeAgo(c.createdAt)}</span>
                  </div>
                  <p className="text-sm text-text-primary">{c.text}</p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      className="text-[11px] text-text-muted hover:text-success-text"
                      onClick={() => resolve(c.id)}
                    >
                      Resolve
                    </button>
                    {(c.authorId === currentUserId || currentUserRole !== "applicant") && (
                      <button
                        type="button"
                        className="text-[11px] text-text-muted hover:text-danger-fill"
                        onClick={() => remove(c.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Resolved (collapsed) */}
          {resolved.length > 0 && (
            <p className="text-[11px] text-text-muted">
              {resolved.length} resolved comment{resolved.length > 1 ? "s" : ""} hidden
            </p>
          )}

          {/* Composer */}
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Leave a comment..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); post(); }
              }}
              disabled={posting}
            />
            <button
              type="button"
              className="btn btn-primary shrink-0 text-xs"
              onClick={post}
              disabled={posting || !text.trim()}
            >
              {posting ? "..." : "Post"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
