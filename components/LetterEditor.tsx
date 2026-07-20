"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Case, LetterRecord, QualityReport, LetterVersion } from "@/lib/db";
import type { LetterRequirement, NarrativeRequirement } from "@/forms/types";
import { extractEvidence, type EvidenceAtom } from "@/lib/drafting";
import { settingsHeaders } from "@/lib/settings";
import { letterQualityFor, type LetterQuality } from "@/lib/scoring";
import { DiffView } from "@/components/DiffView";
import { LetterComments } from "@/components/LetterComments";
import { HighlightedTextarea } from "@/components/HighlightedTextarea";
import { PetitionBriefEditor, type EditorHandle } from "@/components/PetitionBriefEditor";
import { InsightsPanel } from "@/components/InsightsPanel";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import type { EvidenceLedger } from "@/lib/evidenceLedger";

type Props = {
  initialCase: Case;
  initialLetter: LetterRecord;
  letterReq: LetterRequirement;
  currentUserId: string;
  currentUserRole: "admin" | "attorney" | "applicant";
  narrative?: NarrativeRequirement;
  /** Self-petitioner beta: hide "attorney reviewed this" framing — the assigned attorney is an internal concierge account, not a real reviewer. */
  hideAttorneyChrome?: boolean;
};

type Recommender = LetterRecord["recommender"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Letter-quality thresholds live in lib/scoring (letterQualityFor); these
// just map the resolved level to presentation. Visual output unchanged —
// the raw palette classes migrate to tokens in T2-4.
const QUALITY_PILL: Record<LetterQuality, string> = {
  excellent: "bg-success-soft text-success-text",
  acceptable: "bg-warning-soft text-warning-text",
  "needs-work": "bg-danger-soft text-danger-text",
};
const QUALITY_BAR: Record<LetterQuality, string> = {
  excellent: "bg-success-fill",
  acceptable: "bg-warning-fill",
  "needs-work": "bg-danger-fill",
};

function scoreClass(score: number): string {
  return QUALITY_PILL[letterQualityFor(score)];
}

function scoreBarClass(score: number): string {
  return QUALITY_BAR[letterQualityFor(score)];
}

function randomId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ScoreBar({
  label,
  score,
  notes,
}: {
  label: string;
  score: number;
  notes: string;
}) {
  const readable = label.replace(/([A-Z])/g, " $1").trim();
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="capitalize text-text-secondary">{readable}</span>
        <span className="text-text-muted">{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-muted">
        <div
          className={`h-1.5 rounded-full ${scoreBarClass(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      {notes && <p className="text-xs text-text-muted">{notes}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function LetterEditor({ initialCase, initialLetter, letterReq, currentUserId, currentUserRole, narrative, hideAttorneyChrome = false }: Props) {
  const allEvidence = extractEvidence(initialCase.formData);

  const [recommender, setRecommender] = useState<Recommender>(
    initialLetter.recommender
  );
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>(
    initialLetter.selectedEvidence ?? []
  );
  const [draft, setDraft] = useState(initialLetter.currentDraft ?? "");
  const [versions, setVersions] = useState<LetterVersion[]>(
    initialLetter.versions ?? []
  );
  const [qualityReport, setQualityReport] = useState<QualityReport | undefined>(
    initialLetter.qualityReport
  );
  const [drafting, setDrafting] = useState(false);
  const [draftPhase, setDraftPhase] = useState<"generating" | "critiquing" | "saving" | null>(null);
  const [reassessing, setReassessing] = useState(false);
  const [reassessError, setReassessError] = useState("");
  const [liveWordCount, setLiveWordCount] = useState(0);
  const [draftError, setDraftError] = useState("");
  const [groundingFlags, setGroundingFlags] = useState<Array<{ text: string; reason: string; severity: "error" | "warning" }>>([]);
  const [personaDriftSentences, setPersonaDriftSentences] = useState<string[]>([]);
  const [regeneratingPara, setRegeneratingPara] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<string | null>(null);
  const [comparingVersion, setComparingVersion] = useState<string | null>(null);
  const [showInsightsPanel, setShowInsightsPanel] = useState(true);
  const briefEditorRef = useRef<EditorHandle>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<"sent" | "error" | null>(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showGroundingGateModal, setShowGroundingGateModal] = useState(false);
  const [pendingExportUrl, setPendingExportUrl] = useState<string | null>(null);
  const [reviewEmail, setReviewEmail] = useState(initialLetter.recommender.email ?? "");
  const [reviewSending, setReviewSending] = useState(false);
  const [reviewResult, setReviewResult] = useState<"sent" | "error" | null>(null);
  const [reviewStatus, setReviewStatus] = useState<{
    viewed?: string;
    submitted?: string;
  }>({
    viewed: initialLetter.reviewerViewed,
    submitted: initialLetter.reviewerSubmitted,
  });

  // §5.5 autosave contract for the draft. The editor previously had NO save
  // indicator and silently swallowed failed PATCHes — an attorney editing a
  // filed (409-locked) letter lost everything with no signal.
  const [draftSaveState, setDraftSaveState] = useState<"idle" | "saving" | "saved" | "error" | "locked">("idle");
  const draftLockedRef = useRef(false);
  const pendingSaveRef = useRef<{ currentDraft: string; versions: LetterVersion[] } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const evidenceSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const isFirstDraft = useRef(true);

  const [petitionDraftedCount, setPetitionDraftedCount] = useState(0);

  const caseId = initialCase.id;
  const letterId = initialLetter.id;
  const isPetition = letterReq.kind === "petition-letter";

  // Count persisted error-severity grounding flags across all sections (petition)
  // or from the letter's grounding flags (recommendation letters).
  const unresolvedErrorCount = (() => {
    if (isPetition && narrative) {
      const allGF = (initialCase.formData.groundingFlags ?? {}) as Record<string, Record<string, Array<{ severity: string }>>>;
      const narrativeGF = allGF[narrative.id] ?? {};
      return Object.values(narrativeGF).flat().filter(f => f.severity === "error").length;
    }
    return groundingFlags.filter(f => f.severity === "error").length;
  })();

  // Section ids carrying ≥1 error-severity flag — petition path only (letter
  // flags live in ephemeral client state, not formData). Tells us *where* the
  // model hallucinates, per the telemetry spec.
  const sectionsWithErrors = useMemo<string[]>(() => {
    if (!(isPetition && narrative)) return [];
    const allGF = (initialCase.formData.groundingFlags ?? {}) as Record<string, Record<string, Array<{ severity: string }>>>;
    const ng = allGF[narrative.id] ?? {};
    return Object.entries(ng)
      .filter(([, flags]) => Array.isArray(flags) && flags.some((f) => f.severity === "error"))
      .map(([sid]) => sid);
  }, [isPetition, narrative, initialCase.formData]);

  // Grounding-gate telemetry (A2 "(logged)" follow-up). Fire-and-forget beacon
  // — a telemetry failure must never block an export. gate_overridden is the
  // malpractice-risk signal: an attorney exported despite known unverified claims.
  const beaconExport = useCallback((event: string, format: "pdf" | "docx") => {
    try {
      navigator.sendBeacon?.(
        "/api/funnel",
        JSON.stringify({
          event,
          props: { caseId, letterId, userId: currentUserId, isPetition, format, unresolvedErrorCount, sectionsWithErrors },
        })
      );
    } catch { /* swallow — never break export on telemetry */ }
  }, [caseId, letterId, currentUserId, isPetition, unresolvedErrorCount, sectionsWithErrors]);

  const handleExportClick = (url: string, format: "pdf" | "docx") => {
    if (unresolvedErrorCount > 0) {
      beaconExport("export.gate_triggered", format);
      setPendingExportUrl(url);
      setShowGroundingGateModal(true);
    } else {
      beaconExport("export.clean", format);
      window.open(url, "_blank");
    }
  };

  // ----- Autosave evidence selection -----
  useEffect(() => {
    // Skip the initial render — don't save what we just loaded
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (evidenceSaveTimer.current) clearTimeout(evidenceSaveTimer.current);
    evidenceSaveTimer.current = setTimeout(() => {
      fetch(`/api/cases/${caseId}/letters/${letterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...settingsHeaders() },
        body: JSON.stringify({ selectedEvidence }),
      });
    }, 600);
  }, [selectedEvidence, caseId, letterId]);

  // ----- Autosave manual edits -----
  // Persist the draft; surface a retryable error / locked state per §5.5
  // instead of silently dropping the PATCH. `payload` omitted ⇒ retry the
  // last attempted save.
  const saveDraft = useCallback(
    async (payload?: { currentDraft: string; versions: LetterVersion[] }) => {
      const body = payload ?? pendingSaveRef.current;
      if (!body) return;
      pendingSaveRef.current = body;
      setDraftSaveState("saving");
      try {
        const res = await fetch(`/api/cases/${caseId}/letters/${letterId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...settingsHeaders(),
          },
          body: JSON.stringify(body),
        });
        if (res.status === 409) {
          draftLockedRef.current = true;
          setDraftSaveState("locked");
          return;
        }
        if (!res.ok) {
          setDraftSaveState("error");
          return;
        }
        setDraftSaveState("saved");
        setTimeout(() => setDraftSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch {
        setDraftSaveState("error");
      }
    },
    [caseId, letterId]
  );

  const handleDraftChange = (value: string) => {
    setDraft(value);
    setViewingVersion(null); // editing exits version view
    if (draftLockedRef.current) return; // filed letter — stop autosaving
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      // Coalesce into the last manual-edit version if it was < 10 min ago.
      // Prevents ~20 versions per editing session.
      const TEN_MIN = 10 * 60 * 1000;
      const lastIdx = versions.length - 1;
      const last = lastIdx >= 0 ? versions[lastIdx] : null;
      const canCoalesce =
        last?.note === "manual edit" &&
        Date.now() - new Date(last.createdAt).getTime() < TEN_MIN;

      let updatedVersions: LetterVersion[];
      if (canCoalesce) {
        updatedVersions = [
          ...versions.slice(0, lastIdx),
          { ...last, content: value, createdAt: new Date().toISOString() },
        ];
      } else {
        updatedVersions = [
          ...versions,
          { id: randomId(), content: value, createdAt: new Date().toISOString(), note: "manual edit" },
        ];
      }
      setVersions(updatedVersions);
      saveDraft({ currentDraft: value, versions: updatedVersions });
    }, 3000);
  };

  // Unload guard: warn before closing the tab while a draft save is pending or failed.
  useEffect(() => {
    if (draftSaveState !== "saving" && draftSaveState !== "error") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [draftSaveState]);

  // ----- Draft letter (streaming) -----
  const doDraft = async () => {
    setDrafting(true);
    setDraftPhase("generating");
    setDraftError("");
    setGroundingFlags([]);
    setPersonaDriftSentences([]);
    setLiveWordCount(0);

    try {
      // Save recommender + evidence first
      await fetch(`/api/cases/${caseId}/letters/${letterId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...settingsHeaders() },
        body: JSON.stringify({ recommender, selectedEvidence }),
      });

      const res = await fetch(
        `/api/cases/${caseId}/letters/${letterId}/draft/stream`,
        { method: "POST", headers: { "Content-Type": "application/json", ...settingsHeaders() } }
      );

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "Unknown error");
        setDraftError(err);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.t === "c") {
              accumulated += event.v;
              setDraft(accumulated);
              setLiveWordCount(accumulated.split(/\s+/).filter(Boolean).length);
            } else if (event.t === "phase") {
              setDraftPhase(event.v);
            } else if (event.t === "words") {
              setLiveWordCount(event.v);
            } else if (event.t === "critique") {
              setQualityReport(event.r);
              if (event.versions) setVersions(event.versions);
              setDraftPhase(null);
            } else if (event.t === "grounding") {
              setGroundingFlags(event.flags ?? []);
            } else if (event.t === "persona_drift") {
              setPersonaDriftSentences(event.sentences ?? []);
            } else if (event.t === "done") {
              setDraftPhase(null);
            } else if (event.t === "error") {
              setDraftError(event.m);
              setDraftPhase(null);
            }
          } catch { /* skip malformed */ }
        }
      }
    } finally {
      setDrafting(false);
      setDraftPhase(null);
    }
  };

  // ----- Regenerate paragraph -----
  const regenerateParagraph = async (paragraph: string, issue: string) => {
    setRegeneratingPara(paragraph);
    try {
      const res = await fetch(
        `/api/cases/${caseId}/letters/${letterId}/regenerate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...settingsHeaders(),
          },
          body: JSON.stringify({ paragraph, issue }),
        }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (data.letter?.currentDraft) {
        setDraft(data.letter.currentDraft);
        if (data.letter.versions) setVersions(data.letter.versions);
      }
    } finally {
      setRegeneratingPara(null);
    }
  };

  // ----- Highlight paragraph in textarea -----
  const highlightParagraph = (paragraph: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const idx = draft.indexOf(paragraph);
    if (idx === -1) return;
    ta.focus();
    ta.setSelectionRange(idx, idx + paragraph.length);
  };

  // ----- Restore a version -----
  const restoreVersion = (version: LetterVersion) => {
    setDraft(version.content);
    setViewingVersion(null);
  };

  // The displayed draft (when viewing a version, show that version's content)
  const displayedDraft =
    viewingVersion != null
      ? (versions.find((v) => v.id === viewingVersion)?.content ?? draft)
      : draft;

  // ----- Render -----
  return (
    <div className="space-y-6">
      <div className={`grid gap-6 ${showInsightsPanel ? "lg:grid-cols-[1fr_280px]" : "lg:grid-cols-1"}`}>
        {/* Left panel */}
        <div className="space-y-6">
          {/* Recommender profile — hidden for petition letters */}
          {!isPetition && <div className="card space-y-4">
            <h2 className="font-serif text-lg">Recommender profile</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  { id: "name", label: "Name", type: "text" },
                  { id: "title", label: "Title", type: "text" },
                  { id: "institution", label: "Institution", type: "text" },
                ] as { id: keyof Recommender; label: string; type: string }[]
              ).map((f) => (
                <div key={f.id}>
                  <label className="block text-xs font-medium text-text-secondary">
                    {f.label}
                  </label>
                  <input
                    type="text"
                    className="input mt-1"
                    value={String(recommender[f.id] ?? "")}
                    onChange={(e) =>
                      setRecommender((prev) => ({
                        ...prev,
                        [f.id]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-text-secondary">
                  Kind
                </label>
                <select
                  className="input mt-1"
                  value={recommender.kind}
                  onChange={(e) =>
                    setRecommender((prev) => ({
                      ...prev,
                      kind: e.target.value as "independent" | "dependent",
                    }))
                  }
                >
                  <option value="independent">Independent</option>
                  <option value="dependent">Dependent</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary">
                Credentials
              </label>
              <textarea
                className="input mt-1"
                rows={2}
                value={recommender.credentials}
                onChange={(e) =>
                  setRecommender((prev) => ({
                    ...prev,
                    credentials: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary">
                Relationship to applicant
              </label>
              <textarea
                className="input mt-1"
                rows={2}
                value={recommender.relationship}
                onChange={(e) =>
                  setRecommender((prev) => ({
                    ...prev,
                    relationship: e.target.value,
                  }))
                }
              />
            </div>
          </div>}

          {/* Petition brief section editor — replaces evidence picker + draft button */}
          {isPetition && narrative && (() => {
            const narrativeDrafts = (initialCase.formData.narrativeDrafts ?? {}) as Record<string, unknown>;
            const initialSectionDrafts = (narrativeDrafts[narrative.id] ?? {}) as Record<string, string>;
            const sectionAssessments = (initialCase.formData.sectionAssessments ?? {}) as Record<string, unknown>;
            const initialAssessments = (sectionAssessments[narrative.id] ?? {}) as Record<string, unknown>;
            const coherenceReports = (initialCase.formData.coherenceReports ?? {}) as Record<string, unknown>;
            const initialCoherence = coherenceReports[narrative.id] as import("@/app/api/cases/[id]/brief/[narrativeId]/coherence/route").CoherenceReport | undefined;
            const allGroundingFlags = (initialCase.formData.groundingFlags ?? {}) as Record<string, unknown>;
            const initialGroundingFlags = (allGroundingFlags[narrative.id] ?? {}) as Record<string, Array<{ text: string; reason: string; severity: "error" | "warning"; start?: number; end?: number }>>;
            return (
              <PetitionBriefEditor
                ref={briefEditorRef}
                caseId={caseId}
                narrative={narrative}
                initialDrafts={initialSectionDrafts}
                initialAssessments={initialAssessments as Record<string, import("@/app/api/cases/[id]/brief/[narrativeId]/[sectionId]/assess/route").SectionAssessment>}
                initialGroundingFlags={initialGroundingFlags}
                initialCoherence={initialCoherence}
                hideCoherence={true}
                onDraftedCountChange={setPetitionDraftedCount}
                onAssemble={(assembled) => {
                  setDraft(assembled);
                  // Trigger autosave via the existing draft change timer
                  if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
                  autosaveTimer.current = setTimeout(async () => {
                    await fetch(`/api/cases/${caseId}/letters/${letterId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json", ...settingsHeaders() },
                      body: JSON.stringify({ currentDraft: assembled }),
                    });
                  }, 800);
                }}
              />
            );
          })()}

          {/* Evidence — hidden for petition letters (sections handle evidence internally) */}
          {!isPetition && <div className="card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg">Evidence to reference</h2>
              {allEvidence.length > 0 && (
                <div className="flex gap-2 text-xs text-text-muted">
                  <button
                    type="button"
                    className="hover:text-text-primary"
                    onClick={() => setSelectedEvidence(allEvidence.map((a) => a.id))}
                  >
                    Select all
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    className="hover:text-text-primary"
                    onClick={() => setSelectedEvidence([])}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            {allEvidence.length === 0 ? (
              <p className="text-sm text-text-muted">
                No evidence found. Add publications, awards, grants, and other evidence in the Form data tab.
              </p>
            ) : (
              <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
                {(
                  [
                    { kind: "publication", label: "Publications" },
                    { kind: "award",       label: "Awards" },
                    { kind: "grant",       label: "Grants" },
                    { kind: "patent",      label: "Patents" },
                    { kind: "media",       label: "Media coverage" },
                    { kind: "talk",        label: "Invited talks" },
                    { kind: "role",        label: "Peer review / editorial" },
                    { kind: "project",     label: "Projects" },
                  ] as { kind: EvidenceAtom["kind"]; label: string }[]
                )
                  .map(({ kind, label }) => {
                    const group = allEvidence.filter((a) => a.kind === kind);
                    if (group.length === 0) return null;
                    return (
                      <div key={kind}>
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
                          {label}
                        </div>
                        <div className="space-y-1">
                          {group.map((atom) => (
                            <label
                              key={atom.id}
                              className="flex cursor-pointer items-start gap-2 rounded-md p-2 hover:bg-surface-subtle"
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5 shrink-0"
                                checked={selectedEvidence.includes(atom.id)}
                                onChange={(e) =>
                                  setSelectedEvidence((prev) =>
                                    e.target.checked
                                      ? [...prev, atom.id]
                                      : prev.filter((id) => id !== atom.id)
                                  )
                                }
                              />
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium leading-snug">
                                  {atom.summary}
                                </div>
                                {atom.detail && (
                                  <div className="text-xs text-text-muted">{atom.detail}</div>
                                )}
                                {(atom.year || atom.metric) && (
                                  <div className="text-xs text-text-muted">
                                    {[atom.year, atom.metric].filter(Boolean).join(" · ")}
                                  </div>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })
                  .filter(Boolean)}
              </div>
            )}
            {selectedEvidence.length > 0 && (
              <p className="text-xs text-text-muted">
                {selectedEvidence.length} of {allEvidence.length} evidence items selected for this letter
              </p>
            )}
          </div>}

          {/* Draft button + export actions */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Insights panel toggle — far right */}
              <button
                type="button"
                className="ml-auto btn btn-secondary text-xs"
                onClick={() => setShowInsightsPanel(s => !s)}
                title={showInsightsPanel ? "Hide insights panel" : "Show insights panel"}
              >
                {showInsightsPanel ? "Hide panel" : "Insights ▸"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {!isPetition && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={doDraft}
                  disabled={drafting}
                >
                  {drafting ? "Drafting..." : "Draft letter"}
                </button>
              )}
              {draft && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExportClick(`/api/cases/${caseId}/letters/${letterId}/pdf`, "pdf")}
                  >
                    Download PDF
                    {unresolvedErrorCount > 0 && <span className="ml-1.5 rounded-full bg-danger-border px-1.5 py-0.5 text-[10px] font-bold text-danger-text">{unresolvedErrorCount}</span>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => handleExportClick(`/api/cases/${caseId}/letters/${letterId}/docx`, "docx")}
                  >
                    Download Word
                    {unresolvedErrorCount > 0 && <span className="ml-1.5 rounded-full bg-danger-border px-1.5 py-0.5 text-[10px] font-bold text-danger-text">{unresolvedErrorCount}</span>}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowEmailModal(true)}
                  >
                    Email letter
                  </button>
                  {!isPetition && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => { setReviewResult(null); setShowReviewModal(true); }}
                    >
                      Send to recommender
                    </button>
                  )}
                </>
              )}
              {/* Recommender review status badge */}
              {reviewStatus.submitted ? (
                <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success-text">
                  Recommender submitted
                </span>
              ) : reviewStatus.viewed ? (
                <span className="rounded-full bg-info-soft px-2.5 py-1 text-xs font-medium text-info-text">
                  Recommender viewed
                </span>
              ) : initialLetter.reviewInviteSent ? (
                <span className="rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-text">
                  Invite sent
                </span>
              ) : null}
            </div>
            {drafting && draftPhase && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-text-muted" />
                  <span className="text-sm font-medium text-text-secondary">
                    {draftPhase === "generating" && "Generating draft..."}
                    {draftPhase === "saving"     && "Saving draft..."}
                    {draftPhase === "critiquing" && "Running quality critique..."}
                  </span>
                  {draftPhase === "generating" && liveWordCount > 0 && (
                    <span className="text-xs tabular-nums text-text-muted">
                      {liveWordCount} words
                    </span>
                  )}
                </div>
                {draftPhase === "generating" && (
                  <div className="h-1 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-1 animate-[grow_3s_ease-in-out_infinite] rounded-full bg-text-muted" />
                  </div>
                )}
              </div>
            )}
            {draftError && (
              <p className="text-sm text-danger-fill">{draftError}</p>
            )}
          </div>

          {/* Letter editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg">Letter</h2>
              {viewingVersion != null && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={() => {
                      const v = versions.find((v) => v.id === viewingVersion);
                      if (v) restoreVersion(v);
                    }}
                  >
                    Restore this version
                  </button>
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-primary"
                    onClick={() => setViewingVersion(null)}
                  >
                    Back to current
                  </button>
                </div>
              )}
            </div>
            <HighlightedTextarea
              ref={textareaRef}
              className="input min-h-[500px] font-serif text-base leading-relaxed"
              value={displayedDraft}
              onChange={(e) =>
                viewingVersion == null && handleDraftChange(e.target.value)
              }
              readOnly={viewingVersion != null}
              placeholder="Draft will appear here after generation..."
            />
            <div className="mt-1 h-4 text-xs" role="status" aria-live="polite">
              {draftSaveState === "saving" && <span className="text-text-muted">Saving…</span>}
              {draftSaveState === "saved" && <span className="text-text-muted">Saved ✓</span>}
              {draftSaveState === "error" && (
                <span className="text-danger-text">
                  Couldn&apos;t save —{" "}
                  <button type="button" onClick={() => saveDraft()} className="underline font-medium">retry</button>
                </span>
              )}
              {draftSaveState === "locked" && (
                <span className="text-danger-text">This case is filed — content is locked.</span>
              )}
            </div>
          </div>
        </div>

        {/* Right insights panel — versions, coherence, evidence ledger */}
        {showInsightsPanel && (() => {
          const coherenceReports = (initialCase.formData.coherenceReports ?? {}) as Record<string, unknown>;
          const initialCoherence = narrative
            ? (coherenceReports[narrative.id] as import("@/app/api/cases/[id]/brief/[narrativeId]/coherence/route").CoherenceReport | undefined)
            : undefined;
          const evidenceLedger = (initialCase.formData.evidenceLedger ?? null) as EvidenceLedger | null;
          return (
            <InsightsPanel
              caseId={caseId}
              isPetition={isPetition}
              versions={versions}
              currentDraft={draft}
              viewingVersion={viewingVersion}
              setViewingVersion={setViewingVersion}
              comparingVersion={comparingVersion}
              setComparingVersion={setComparingVersion}
              onRestoreVersion={restoreVersion}
              narrativeId={narrative?.id}
              outline={narrative?.outline}
              draftedCount={petitionDraftedCount}
              totalSections={narrative?.outline.length}
              initialCoherence={initialCoherence}
              onJumpToSection={(id) => briefEditorRef.current?.jumpToSection(id)}
              evidenceLedger={isPetition ? evidenceLedger : null}
            />
          );
        })()}
      </div>

      {/* Diff view */}
      {comparingVersion && (() => {
        const vIdx = versions.findIndex((vv) => vv.id === comparingVersion);
        if (vIdx === -1) return null;
        const v = versions[vIdx];
        const vNum = vIdx + 1;
        const prev = vIdx > 0 ? versions[vIdx - 1] : null;
        const prevNum = vIdx;
        // If this is the latest version, compare it against the live textarea draft
        const isLatest = vIdx === versions.length - 1;
        const oldText = prev ? prev.content : "";
        const newText = isLatest ? draft : v.content;
        const oldLabel = prev
          ? `v${prevNum} · ${prev.note ?? ""}`
          : "Empty";
        const newLabel = isLatest
          ? `v${vNum} · ${v.note ?? ""} (current)`
          : `v${vNum} · ${v.note ?? ""}`;
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg">
                {prev ? `v${prevNum} → v${vNum}` : `v${vNum} · what changed`}
                {isLatest && " (vs current)"}
              </h2>
              <button
                type="button"
                className="text-xs text-text-muted hover:text-text-primary"
                onClick={() => setComparingVersion(null)}
              >
                Close diff
              </button>
            </div>
            <DiffView
              oldText={oldText}
              newText={newText}
              oldLabel={oldLabel}
              newLabel={newLabel}
            />
          </div>
        );
      })()}

      {/* Quality report — shown after draft, with re-assess button */}
      {(qualityReport || draft) && !isPetition && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-lg">Quality report</h2>
              {qualityReport && (
                <>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${scoreClass(qualityReport.overallScore)}`}>
                    Overall: {qualityReport.overallScore}
                  </span>
                  {qualityReport.readyToSend && (
                    <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-text">
                      Ready to send
                    </span>
                  )}
                </>
              )}
            </div>
            {draft && (
              <button
                type="button"
                className="btn btn-secondary text-sm"
                disabled={reassessing || drafting}
                onClick={async () => {
                  setReassessing(true);
                  setReassessError("");
                  try {
                    const res = await fetch(`/api/cases/${caseId}/letters/${letterId}/assess`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", ...settingsHeaders() },
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
                    setQualityReport(data);
                  } catch (e) {
                    setReassessError(e instanceof Error ? e.message : "Assessment failed");
                  } finally {
                    setReassessing(false);
                  }
                }}
              >
                {reassessing ? "Assessing…" : qualityReport ? "Re-assess" : "Run Assessment"}
              </button>
            )}
          </div>
          {reassessError && <p className="text-xs text-danger-fill">{reassessError}</p>}
          {reassessing && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-text-muted" />
              Running quality assessment…
            </div>
          )}

          {/* Dimension bars */}
          {qualityReport && !reassessing && (
            <>
              {qualityReport.dimensions && Object.keys(qualityReport.dimensions).length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(qualityReport.dimensions).map(
                    ([key, { score, notes }]) => (
                      <ScoreBar key={key} label={key} score={score} notes={notes} />
                    )
                  )}
                </div>
              )}

              {/* Strengths */}
              {(qualityReport.strengths ?? []).length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium text-text-secondary">Strengths</h3>
                  <ul className="space-y-0.5">
                    {qualityReport.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-text-secondary">{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Weak paragraphs */}
              {(qualityReport.weakParagraphs ?? []).length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium text-text-secondary">Weak paragraphs</h3>
                  <div className="space-y-2">
                    {qualityReport.weakParagraphs.map((wp, i) => (
                      <div
                        key={i}
                        className="cursor-pointer rounded-md border border-border-default p-3 hover:border-border-strong"
                        onClick={() => highlightParagraph(wp.paragraph)}
                      >
                        <p className="line-clamp-2 text-xs text-text-secondary">{wp.paragraph}</p>
                        <p className="mt-1 text-xs font-medium text-warning-text">{wp.issue}</p>
                        {regeneratingPara === wp.paragraph ? (
                          <p className="mt-2 animate-pulse text-xs text-text-muted">Regenerating...</p>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary mt-2 text-xs"
                            onClick={(e) => { e.stopPropagation(); regenerateParagraph(wp.paragraph, wp.issue); }}
                          >
                            Regenerate this paragraph
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {!qualityReport && !reassessing && (
            <p className="text-sm text-text-muted">Draft the letter first, then run an assessment.</p>
          )}
        </div>
      )}

      {/* Grounding flags */}
      {groundingFlags.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-danger-text">Grounding issues</h2>
            <button type="button" className="text-xs text-text-muted hover:text-text-secondary" onClick={() => setGroundingFlags([])}>Dismiss all</button>
          </div>
          <p className="text-xs text-text-muted">These specific claims could not be verified against the evidence record. Review and dismiss each one if it&apos;s correct.</p>
          <div className="flex gap-4 text-[10px]">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-danger-border" /> Error — likely inaccurate</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-warning-border" /> Warning — unverified</span>
          </div>
          <ul className="space-y-2">
            {groundingFlags.map((f, i) => (
              <li key={i} className={`rounded-lg border px-4 py-3 ${f.severity === "error" ? "border-danger-border bg-danger-bg" : "border-warning-border bg-warning-bg"}`}>
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${f.severity === "error" ? "bg-danger-border text-danger-text" : "bg-warning-border text-warning-text"}`}>{f.severity}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">&ldquo;{f.text}&rdquo;</p>
                    <p className="mt-0.5 text-xs text-text-secondary">{f.reason}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-mono text-text-muted hover:bg-surface-muted hover:text-text-secondary"
                      onClick={() => highlightParagraph(f.text)}
                      title="Jump to this text in the draft"
                    >
                      Find ↗
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-muted hover:text-text-secondary"
                      onClick={() => setGroundingFlags(prev => prev.filter((_, j) => j !== i))}
                      title="Ignore this flag"
                    >
                      Ignore
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Persona drift warnings — recommender accidentally speaking as the applicant */}
      {personaDriftSentences.length > 0 && (
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg text-warning-text">Voice drift detected</h2>
            <button type="button" className="text-xs text-text-muted hover:text-text-secondary" onClick={() => setPersonaDriftSentences([])}>Dismiss all</button>
          </div>
          <p className="text-xs text-text-muted">These sentences may have the recommender speaking in the applicant&apos;s voice — claiming the applicant&apos;s work as their own. Review and correct before sending.</p>
          <ul className="space-y-2">
            {personaDriftSentences.map((sentence, i) => (
              <li key={i} className="rounded-lg border border-warning-border bg-warning-bg px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase bg-warning-border text-warning-text">drift</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">&ldquo;{sentence}&rdquo;</p>
                    <p className="mt-0.5 text-xs text-text-secondary">Recommender appears to be speaking as the applicant here.</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs font-mono text-text-muted hover:bg-surface-muted hover:text-text-secondary"
                      onClick={() => highlightParagraph(sentence)}
                    >
                      Find ↗
                    </button>
                    <button
                      type="button"
                      className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-muted hover:text-text-secondary"
                      onClick={() => setPersonaDriftSentences(prev => prev.filter((_, j) => j !== i))}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Grounding gate modal — requires attorney acknowledgment before exporting with unresolved errors */}
      {showGroundingGateModal && (
        <Modal
          open={showGroundingGateModal}
          onClose={() => { setShowGroundingGateModal(false); setPendingExportUrl(null); }}
          title="Unverified claims detected"
          size="md"
        >
          <p className="text-sm text-text-secondary">
            This document has <span className="font-semibold text-danger-text">{unresolvedErrorCount} unverified claim{unresolvedErrorCount !== 1 ? "s" : ""}</span> flagged by the grounding auditor. These may be hallucinated facts that do not appear in the evidence record.
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Filing a petition with inaccurate claims is a malpractice risk. Please review the grounding issues before exporting.
          </p>
          <ModalFooter>
            <button
              className="btn btn-secondary"
              onClick={() => { setShowGroundingGateModal(false); setPendingExportUrl(null); }}
            >
              Review first
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                setShowGroundingGateModal(false);
                if (pendingExportUrl) {
                  beaconExport("export.gate_overridden", pendingExportUrl.endsWith("/pdf") ? "pdf" : "docx");
                  window.open(pendingExportUrl, "_blank");
                }
                setPendingExportUrl(null);
              }}
            >
              Export anyway
            </button>
          </ModalFooter>
        </Modal>
      )}

      {/* Email modal */}
      {showEmailModal && (
        <Modal
          open={showEmailModal}
          onClose={() => { setShowEmailModal(false); setEmailResult(null); setEmailTo(""); }}
          title="Email letter"
          size="md"
        >
            {emailResult === "sent" ? (
              <div className="space-y-3">
                <p className="text-sm text-success-text">
                  Letter sent to {emailTo}.
                </p>
                <button className="btn btn-secondary" onClick={() => { setShowEmailModal(false); setEmailResult(null); setEmailTo(""); }}>Close</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-text-secondary">
                  The letter body and a PDF attachment will be sent to the address below.
                </p>
                <input
                  type="email"
                  className="input"
                  placeholder="recipient@example.com"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  disabled={emailSending}
                />
                {emailResult === "error" && (
                  <p className="text-sm text-danger-fill">Send failed — try again, or contact support if the problem persists.</p>
                )}
                <ModalFooter>
                  <button className="btn btn-secondary" onClick={() => setShowEmailModal(false)} disabled={emailSending}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    disabled={emailSending || !emailTo.trim()}
                    onClick={async () => {
                      setEmailSending(true);
                      setEmailResult(null);
                      const res = await fetch(`/api/cases/${caseId}/letters/${letterId}/email`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ to: emailTo }),
                      });
                      setEmailResult(res.ok ? "sent" : "error");
                      setEmailSending(false);
                    }}
                  >
                    {emailSending ? "Sending..." : "Send"}
                  </button>
                </ModalFooter>
              </>
            )}
        </Modal>
      )}

      {/* Send to recommender modal */}
      {showReviewModal && (
        <Modal
          open={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          title="Send to recommender"
          size="md"
        >
            <p className="text-sm text-text-muted">
              The recommender will receive an email with a secure link to review and edit this draft.
              No account is required on their end.
            </p>
            {reviewResult === "sent" ? (
              <div className="rounded-lg bg-success-bg p-4 text-center">
                <p className="font-medium text-success-text">Invite sent!</p>
                <p className="mt-1 text-sm text-success-text">
                  {reviewEmail} will receive an email with the review link shortly.
                </p>
                <button className="btn btn-secondary mt-4" onClick={() => setShowReviewModal(false)}>
                  Close
                </button>
              </div>
            ) : (
              <>
                <label className="mb-1 block text-sm font-medium text-text-secondary">
                  Recommender email
                </label>
                <input
                  type="email"
                  className="input mb-1 w-full"
                  placeholder="professor@university.edu"
                  value={reviewEmail}
                  onChange={(e) => setReviewEmail(e.target.value)}
                  disabled={reviewSending}
                />
                <p className="mb-4 text-xs text-text-muted">
                  Invite is valid for 14 days. They can resubmit multiple times using the same link.
                </p>
                {reviewResult === "error" && (
                  <p className="mb-3 text-sm text-danger-fill">Failed to send — please try again.</p>
                )}
                <ModalFooter>
                  <button className="btn btn-secondary" onClick={() => setShowReviewModal(false)} disabled={reviewSending}>
                    Cancel
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={reviewSending || !reviewEmail.trim()}
                    onClick={async () => {
                      setReviewSending(true);
                      setReviewResult(null);
                      const res = await fetch(`/api/cases/${caseId}/letters/${letterId}/send-review`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email: reviewEmail }),
                      });
                      setReviewSending(false);
                      if (res.ok) {
                        setReviewResult("sent");
                        setReviewStatus((s) => ({ ...s }));
                      } else {
                        setReviewResult("error");
                      }
                    }}
                  >
                    {reviewSending ? "Sending..." : "Send invite"}
                  </button>
                </ModalFooter>
              </>
            )}
        </Modal>
      )}

      {/* Letter comments — hidden for beta self-drafters, same reasoning as hideAttorneyChrome above */}
      {!hideAttorneyChrome && (
        <LetterComments
          caseId={caseId}
          letterId={letterId}
          initialComments={initialLetter.comments ?? []}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
}
