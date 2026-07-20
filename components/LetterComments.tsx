"use client";

import { useState } from "react";
import type { LetterComment } from "@/lib/db";

type Props = {
  caseId: string;
  letterId: string;
  initialComments: LetterComment[];
  currentUserId: string;
  currentUserRole: "admin" | "attorney" | "applicant";
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function LetterComments({
  caseId,
  letterId,
  initialComments,
  currentUserId,
  currentUserRole,
}: Props) {
  const [comments, setComments] = useState<LetterComment[]>(initialComments);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);

  const active = comments.filter((c) => !c.resolved);
  const resolvedCount = comments.filter((c) => c.resolved).length;

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    const res = await fetch(`/api/cases/${caseId}/letters/${letterId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const comment: LetterComment = await res.json();
      setComments((prev) => [...prev, comment]);
      setText("");
    }
    setPosting(false);
  };

  const resolve = async (commentId: string) => {
    const res = await fetch(
      `/api/cases/${caseId}/letters/${letterId}/comments/${commentId}`,
      { method: "PATCH" }
    );
    if (res.ok)
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, resolved: true } : c))
      );
  };

  const remove = async (commentId: string) => {
    const res = await fetch(
      `/api/cases/${caseId}/letters/${letterId}/comments/${commentId}`,
      { method: "DELETE" }
    );
    if (res.ok) setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg">Review comments</h2>
        {active.length > 0 && (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
            {active.length} open
          </span>
        )}
      </div>

      {active.length === 0 && resolvedCount === 0 && (
        <p className="text-sm text-text-muted">
          {currentUserRole !== "applicant"
            ? "Leave comments for the applicant below."
            : "Your attorney hasn't left comments yet."}
        </p>
      )}

      {/* Active comments */}
      {active.length > 0 && (
        <div className="space-y-4 divide-y divide-border-subtle">
          {active.map((c) => (
            <div key={c.id} className="space-y-1 pt-4 first:pt-0">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="font-medium text-text-primary">{c.authorName}</span>
                <span className={`badge badge-role-${c.authorRole}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                  {c.authorRole}
                </span>
                <span>{timeAgo(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-text-secondary">{c.text}</p>
              <div className="flex gap-3 pt-0.5">
                <button
                  type="button"
                  className="text-[11px] text-text-muted hover:text-success-text"
                  onClick={() => resolve(c.id)}
                >
                  Mark resolved
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

      {resolvedCount > 0 && (
        <p className="text-xs text-text-muted">
          {resolvedCount} resolved comment{resolvedCount > 1 ? "s" : ""} hidden
        </p>
      )}

      {/* Composer */}
      <div className="space-y-2 border-t border-border-subtle pt-4">
        <textarea
          className="input text-sm"
          rows={3}
          placeholder={
            currentUserRole !== "applicant"
              ? "Add feedback for the applicant..."
              : "Reply to attorney feedback..."
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={posting}
        />
        <button
          type="button"
          className="btn btn-primary text-sm"
          onClick={post}
          disabled={posting || !text.trim()}
        >
          {posting ? "Posting..." : "Post comment"}
        </button>
      </div>
    </div>
  );
}
