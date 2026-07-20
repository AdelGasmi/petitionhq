"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/lib/db";

type Props = {
  caseId: string;
  currentUserId: string;
  currentUserRole: "admin" | "attorney" | "applicant";
  hasAttorney: boolean;
};

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessagesTab({ caseId, currentUserId, currentUserRole, hasAttorney }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/messages`);
    if (res.ok) setMessages(await res.json());
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    const res = await fetch(`/api/cases/${caseId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setText("");
    }
    setSending(false);
  };

  if (!hasAttorney && currentUserRole === "applicant") {
    return (
      <div className="empty-state">
        <p className="empty-state-title">No attorney assigned yet</p>
        <p className="empty-state-body">Once an attorney joins your case, you can message them here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Thread */}
      <div className="card flex min-h-[400px] flex-col gap-3 overflow-y-auto">
        {loading ? (
          <p className="text-sm text-stone-400">Loading...</p>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-stone-500">No messages yet</p>
              <p className="text-xs text-stone-400">Start the conversation below.</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.senderId === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}
              >
                <div className="flex items-center gap-2 text-xs text-stone-400">
                  <span className="font-medium text-stone-600">{m.senderName}</span>
                  <span className={`badge badge-role-${m.senderRole}`} style={{ fontSize: "10px", padding: "2px 6px" }}>
                    {m.senderRole}
                  </span>
                  <span>{formatTime(m.createdAt)}</span>
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
                    isMine
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-800"
                  }`}
                >
                  {m.text}
                </div>
                {isMine && !m.read && (
                  <span className="text-[10px] text-stone-400">Sent</span>
                )}
                {isMine && m.read && (
                  <span className="text-[10px] text-stone-400">Read</span>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={send} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={sending}
        />
        <button
          type="submit"
          className="btn btn-primary shrink-0"
          disabled={sending || !text.trim()}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </form>
    </div>
  );
}
