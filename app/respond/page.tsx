"use client";

/**
 * /respond?token=xxx&action=approve|reject
 *
 * Landing page for applicant approve/reject links sent via email.
 * Auto-submits on load, shows confirmation or error.
 */

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PetitionMark } from "@/components/icons/PetitionMark";

type State = "loading" | "approved" | "rejected" | "already_done" | "error";

function RespondForm() {
  const params = useSearchParams();
  const token  = params.get("token") ?? "";
  const action = params.get("action") as "approve" | "reject" | null;
  const [state, setState]     = useState<State>("loading");
  const [note, setNote]       = useState("");
  const [showNote, setShowNote] = useState(false);

  // For reject: show a note field before auto-submitting
  useEffect(() => {
    if (!token || !action) { setState("error"); return; }
    if (action === "reject") { setShowNote(true); return; }
    // Approve: auto-submit immediately
    submit("approve");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(act: "approve" | "reject") {
    setState("loading");
    try {
      // Token encodes leadId — decode it via server
      const res = await fetch(`/api/leads/by-token/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: act, note: note || undefined }),
      });
      const data = await res.json();
      if (res.status === 409) { setState("already_done"); return; }
      if (!res.ok) { setState("error"); return; }
      setState(data.action === "approved" ? "approved" : "rejected");
    } catch {
      setState("error");
    }
  }

  if (state === "loading" && !showNote) {
    return (
      <div className="text-center space-y-3">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-default border-t-stone-900" />
        <p className="text-text-muted text-sm">Processing your response…</p>
      </div>
    );
  }

  if (state === "approved") return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success-soft">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-success-text"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
      </div>
      <h1 className="font-serif text-2xl">Attorney accepted</h1>
      <p className="text-text-muted text-sm">
        Your attorney will reach out within 24 hours to begin your petition.
      </p>
    </div>
  );

  if (state === "rejected") return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-text-muted"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z" clipRule="evenodd" /></svg>
      </div>
      <h1 className="font-serif text-2xl">Declined</h1>
      <p className="text-text-muted text-sm">
        We've notified the attorney. Your case will be available for other attorneys to review.
      </p>
    </div>
  );

  if (state === "already_done") return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-soft">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-warning-text"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 0 1 .67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 1 1-.671-1.34l.041-.022ZM12 9a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg>
      </div>
      <h1 className="font-serif text-2xl">Already responded</h1>
      <p className="text-text-muted text-sm">
        You've already responded to this request. Check your email for next steps.
      </p>
    </div>
  );

  if (state === "error") return (
    <div className="text-center space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-danger-fill"><path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" /></svg>
      </div>
      <h1 className="font-serif text-2xl">Link expired or invalid</h1>
      <p className="text-text-muted text-sm">
        This link may have expired (7 days). Contact{" "}
        <a href="mailto:support@petitionhq.us" className="underline">support@petitionhq.us</a>.
      </p>
    </div>
  );

  // Reject flow — show optional note field
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl">Decline this attorney?</h1>
        <p className="text-text-muted text-sm">
          You can optionally share a reason. Your lead will be made available to other attorneys.
        </p>
      </div>
      <div className="card space-y-4">
        <label className="block text-sm font-medium text-text-secondary">
          Reason <span className="text-text-muted">(optional)</span>
        </label>
        <textarea
          className="input w-full"
          rows={3}
          placeholder="e.g. I'm not ready to proceed yet, or I'd prefer a different specialty…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            className="btn w-full"
            onClick={() => { setShowNote(false); submit("approve"); }}
          >
            Actually, accept
          </button>
          <button
            className="btn btn-primary w-full bg-brand-primary-hover"
            onClick={() => submit("reject")}
          >
            Decline attorney
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RespondPage() {
  return (
    <div className="mx-auto max-w-sm pt-20 px-4">
      <div className="mb-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary p-2 mb-4">
          <PetitionMark className="h-full w-full text-white" />
        </div>
        <p className="text-sm text-text-muted">PetitionHQ</p>
      </div>
      <Suspense>
        <RespondForm />
      </Suspense>
    </div>
  );
}
