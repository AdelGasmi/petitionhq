"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { PetitionMark } from "@/components/icons/PetitionMark";

type ReviewPayload = {
  letter: {
    requirementId: string;
    recommender: { name: string; title: string; institution: string };
    currentDraft?: string;
    reviewerSubmitted?: string;
  };
  caseTitle: string;
  applicantName: string;
  requirementTitle: string;
};

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "done" | "invalid">("loading");
  const [wordCount, setWordCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(`/api/review/${token}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: ReviewPayload) => {
        setPayload(data);
        const d = data.letter.currentDraft ?? "";
        setDraft(d);
        setWordCount(d.trim() ? d.trim().split(/\s+/).length : 0);
        setStatus(data.letter.reviewerSubmitted ? "done" : "ready");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleChange = (v: string) => {
    setDraft(v);
    setWordCount(v.trim() ? v.trim().split(/\s+/).length : 0);
  };

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    setStatus("submitting");
    const res = await fetch(`/api/review/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft }),
    });
    setStatus(res.ok ? "done" : "ready");
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <div className="text-text-muted">Loading…</div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <div className="max-w-md rounded-xl border border-border-default bg-surface-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-text-muted"><path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" /></svg>
          </div>
          <h1 className="mb-2 font-serif text-xl font-semibold">Link invalid or expired</h1>
          <p className="text-sm text-text-muted">
            This review link is no longer valid. Please contact the attorney or applicant for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
        <div className="max-w-md rounded-xl border border-border-default bg-surface-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-success-bg">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-success-text">
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="mb-2 font-serif text-xl font-semibold">Letter submitted</h1>
          <p className="text-text-secondary">
            Thank you{payload?.letter.recommender.name ? `, ${payload.letter.recommender.name}` : ""}. Your letter for{" "}
            <strong>{payload?.applicantName}</strong> has been received and will be included in their petition.
          </p>
          <p className="mt-4 text-sm text-text-muted">You may close this tab.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-subtle">
      {/* Header */}
      <header className="border-b border-border-default bg-surface-card px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-brand-primary p-1">
                <PetitionMark className="h-full w-full text-white" />
              </div>
              <span className="font-serif text-lg font-semibold text-text-primary">PetitionHQ</span>
            </div>
            <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
              Recommender review
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {/* Context card */}
        <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
          <h1 className="mb-1 font-serif text-xl font-semibold text-text-primary">
            Letter of Recommendation for {payload?.applicantName}
          </h1>
          <p className="mb-4 text-sm text-text-muted">
            Case: {payload?.caseTitle}
          </p>

          <div className="mb-4 rounded-lg bg-surface-subtle p-4 text-sm text-text-secondary">
            <p className="mb-1 font-medium">Dear {payload?.letter.recommender.name},</p>
            <p>
              A draft letter of recommendation has been prepared for your review. Please read it carefully,
              edit any wording you'd like to change, and click <strong>Submit letter</strong> when you're satisfied.
              Your submitted version will be used directly in {payload?.applicantName}'s EB-2 NIW petition.
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-text-muted">
            <span>
              <span className="font-medium text-text-secondary">{payload?.letter.recommender.name}</span>
              {payload?.letter.recommender.title && ` · ${payload.letter.recommender.title}`}
            </span>
            {payload?.letter.recommender.institution && (
              <span className="text-text-muted">@ {payload.letter.recommender.institution}</span>
            )}
          </div>
        </div>

        {/* Editor */}
        <div className="rounded-xl border border-border-default bg-surface-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
            <span className="text-sm font-medium text-text-secondary">Draft letter</span>
            <span className="text-xs text-text-muted">{wordCount.toLocaleString()} words</span>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full resize-none rounded-b-xl bg-surface-card px-5 py-4 font-mono text-sm leading-relaxed text-text-primary outline-none"
            style={{ minHeight: "520px" }}
            placeholder="The draft will appear here…"
          />
        </div>

        {/* Instructions + submit */}
        <div className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-medium text-text-secondary">Before you submit</h2>
          <ul className="mb-5 space-y-1.5 text-sm text-text-secondary">
            <li className="flex gap-2">
              <span className="text-text-muted">•</span>
              Make sure your name, title, and institution are accurate in the letter
            </li>
            <li className="flex gap-2">
              <span className="text-text-muted">•</span>
              Verify that specific claims about {payload?.applicantName ?? "the applicant"}'s work are correct
            </li>
            <li className="flex gap-2">
              <span className="text-text-muted">•</span>
              The letter should be on your behalf — edit freely to match your voice
            </li>
            <li className="flex gap-2">
              <span className="text-text-muted">•</span>
              Once submitted, the attorney will be notified. You can still edit and resubmit using this same link while it's valid.
            </li>
          </ul>

          <button
            onClick={handleSubmit}
            disabled={status === "submitting" || !draft.trim()}
            className="btn btn-primary w-full"
          >
            {status === "submitting" ? "Submitting…" : "Submit letter"}
          </button>
        </div>
      </main>
    </div>
  );
}
