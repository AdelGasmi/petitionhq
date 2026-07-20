"use client";

import { useState, useEffect, useCallback } from "react";

type Note = {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function AdminNotes({ caseId }: { caseId: string }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/notes`);
    if (res.ok) setNotes(await res.json());
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/cases/${caseId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setSaving(false);
    if (res.ok) {
      setText("");
      load();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to save note.");
    }
  };

  const remove = async (noteId: string) => {
    await fetch(`/api/cases/${caseId}/notes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="font-serif text-lg">Admin notes</h3>
        <span className="badge badge-role-admin text-[10px]">
          admin only
        </span>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-text-muted">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className="group relative rounded-lg border border-border-default bg-surface-card px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-text-secondary">{n.authorName}</span>
                <span className="text-xs text-text-muted" title={n.createdAt}>{timeAgo(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">{n.text}</p>
              <button
                type="button"
                className="absolute right-2 top-2 hidden text-xs text-text-disabled hover:text-danger-fill group-hover:block"
                onClick={() => remove(n.id)}
                title="Delete note"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={submit} className="space-y-2">
        <textarea
          className="input min-h-[80px] resize-y text-sm"
          placeholder="Add an internal note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        {error && <p className="text-xs text-danger-fill">{error}</p>}
        <button type="submit" className="btn btn-secondary text-sm" disabled={saving || !text.trim()}>
          {saving ? "Saving…" : "Add note"}
        </button>
      </form>
    </div>
  );
}
