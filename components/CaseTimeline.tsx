"use client";

import type { Case } from "@/lib/db";

type Milestone = {
  label: string;
  status: "done" | "current" | "upcoming";
  detail?: string;
};

function deriveMilestones(c: Case): Milestone[] {
  const docs = Object.values(c.documents);
  const letters = Object.values(c.letters);
  const docsUploaded = docs.filter((d) => d.status === "uploaded" || d.status === "validated").length;
  const totalDocs = docs.length;
  const draftsReady = letters.filter((l) => l.currentDraft).length;
  const totalLetters = letters.length;
  const hasMessages = c.messages.length > 0;

  const milestones: Milestone[] = [];

  // 1. Case created
  milestones.push({
    label: "Case opened",
    status: "done",
    detail: formatDate(c.createdAt),
  });

  // 2. Data entry
  const fdKeys = Object.keys(c.formData);
  const hasFormData = fdKeys.length > 2; // more than just petitionerInfo seed
  milestones.push({
    label: "Profile completed",
    status: hasFormData ? "done" : c.status === "draft" ? "current" : "done",
    detail: hasFormData ? undefined : "Awaiting applicant input",
  });

  // 3. Documents uploaded
  if (totalDocs > 0) {
    milestones.push({
      label: "Evidence uploaded",
      status: docsUploaded === totalDocs ? "done" : docsUploaded > 0 ? "current" : "upcoming",
      detail: `${docsUploaded} of ${totalDocs} documents`,
    });
  } else {
    milestones.push({
      label: "Evidence uploaded",
      status: "upcoming",
    });
  }

  // 4. Letters drafted
  if (totalLetters > 0) {
    milestones.push({
      label: "Letters drafted",
      status: draftsReady === totalLetters ? "done" : draftsReady > 0 ? "current" : "upcoming",
      detail: `${draftsReady} of ${totalLetters} letters`,
    });
  } else {
    milestones.push({
      label: "Letters drafted",
      status: "upcoming",
    });
  }

  // 5. Attorney review
  milestones.push({
    label: "Attorney review",
    status: c.reviewStatus === "accepted" ? "done" : c.reviewStatus === "pending" ? "current" : "upcoming",
    detail: c.reviewStatus === "accepted"
      ? `Reviewed ${formatDate(c.reviewRespondedAt)}`
      : c.reviewStatus === "pending"
      ? "Under review"
      : undefined,
  });

  // 6. Filed
  milestones.push({
    label: "Petition filed",
    status: c.status === "filed" ? "done" : c.status === "ready" ? "current" : "upcoming",
    detail: c.status === "filed" ? "Submitted to USCIS" : c.status === "ready" ? "Ready to file" : undefined,
  });

  return milestones;
}

function formatDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function CaseTimeline({ caseData }: { caseData: Case }) {
  const milestones = deriveMilestones(caseData);
  // Progress = completed milestones (+ half-credit for one in progress), divided
  // by total. Counting "done" directly is robust when done milestones are
  // non-contiguous (e.g. Letters drafted before Evidence uploaded) — the old
  // "index of the current step" math returned 0% whenever no step was "current".
  const doneCount = milestones.filter((m) => m.status === "done").length;
  const hasCurrent = milestones.some((m) => m.status === "current");
  const progressPct = Math.round(
    ((doneCount + (hasCurrent ? 0.5 : 0)) / milestones.length) * 100,
  );

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-primary">Case progress</h3>
        <span className="text-xs font-medium text-text-muted">{progressPct}%</span>
      </div>

      <div className="progress">
        <div className="progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="relative space-y-0">
        {milestones.map((m, i) => {
          const isLast = i === milestones.length - 1;
          return (
            <div key={m.label} className="flex items-start gap-3">
              {/* Vertical line + dot */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    m.status === "done"
                      ? "bg-success-bg text-success-text border border-success-border"
                      : m.status === "current"
                      ? "bg-brand-primary text-white"
                      : "bg-surface-muted text-text-muted border border-border-default"
                  }`}
                >
                  {m.status === "done" ? "✓" : i + 1}
                </div>
                {!isLast && (
                  <div
                    className={`w-px flex-1 min-h-[20px] ${
                      m.status === "done" ? "bg-success-border" : "bg-border-default"
                    }`}
                  />
                )}
              </div>
              {/* Label + detail */}
              <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
                <p
                  className={`text-sm font-medium ${
                    m.status === "done"
                      ? "text-text-primary"
                      : m.status === "current"
                      ? "text-brand-primary"
                      : "text-text-muted"
                  }`}
                >
                  {m.label}
                </p>
                {m.detail && (
                  <p className="text-xs text-text-muted">{m.detail}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
