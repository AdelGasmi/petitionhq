"use client";

import { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from "react";
import type { NarrativeRequirement } from "@/forms/types";
import { settingsHeaders } from "@/lib/settings";
import type { SectionAssessment } from "@/app/api/cases/[id]/brief/[narrativeId]/[sectionId]/assess/route";
import type { CoherenceReport } from "@/app/api/cases/[id]/brief/[narrativeId]/coherence/route";
import { HighlightedTextarea } from "@/components/HighlightedTextarea";

type SectionDrafts = Record<string, string>;
type SectionAssessments = Record<string, SectionAssessment>;

function compiledIssueContext(assessment: SectionAssessment): string {
  return assessment.issues
    .map((iss, i) => `Issue ${i + 1}: ${iss.problem}\nFix: ${iss.fix}`)
    .join("\n\n");
}

function deriveIssueContexts(assessments: SectionAssessments): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, a] of Object.entries(assessments)) {
    if (!a.ready && a.issues.length > 0) out[id] = compiledIssueContext(a);
  }
  return out;
}

type SectionGroundingFlags = Record<string, Array<{ text: string; reason: string; severity: "error" | "warning"; start?: number; end?: number }>>;

type Props = {
  caseId: string;
  narrative: NarrativeRequirement;
  initialDrafts: SectionDrafts;
  initialAssessments?: SectionAssessments;
  initialGroundingFlags?: SectionGroundingFlags;
  initialCoherence?: CoherenceReport;
  onAssemble?: (fullText: string) => void;
  /** Suppress the inline CoherenceBlock — parent will render it elsewhere */
  hideCoherence?: boolean;
  /** Called whenever the drafted-section count changes */
  onDraftedCountChange?: (count: number) => void;
};

function assembleBrief(outline: NarrativeRequirement["outline"], drafts: SectionDrafts): string {
  return outline
    .filter((s) => drafts[s.id]?.trim())
    .map((s) => `${s.heading.toUpperCase()}\n\n${drafts[s.id].trim()}`)
    .join("\n\n\n");
}

type DraftState = "idle" | "generating" | "done" | "error";

function wc(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function pillLabel(id: string): string {
  const map: Record<string, string> = {
    intro: "Intro",
    "petitioner-qualifications": "Quals",
    "prong1-merit": "P1 Merit",
    "prong1-importance": "P1 Importance",
    prong2: "Prong 2",
    prong3: "Prong 3",
    conclusion: "Conclusion",
  };
  return map[id] ?? id;
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------

function ScoreBadge({ score, size = "sm" }: { score: number; size?: "sm" | "lg" }) {
  const color = score >= 78 ? "bg-success-soft text-success-text" : score >= 55 ? "bg-warning-soft text-warning-text" : "bg-danger-soft text-danger-text";
  const cls = size === "lg" ? "px-3 py-1 text-sm font-bold" : "px-2 py-0.5 text-xs font-semibold";
  return <span className={`rounded-full ${color} ${cls}`}>{score}/100</span>;
}

function Bar({ score }: { score: number }) {
  const color = score >= 78 ? "bg-success-fill" : score >= 55 ? "bg-warning-fill" : "bg-danger-fill";
  return (
    <div className="h-1 w-full rounded-full bg-surface-muted mt-1">
      <div className={`h-1 rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card
// ---------------------------------------------------------------------------

type ExcerptHint = Array<{ heading: string; excerpt: string }>;

function SectionCard({
  caseId, narrativeId, section, draft, onChange, onSave,
  assessment, assessingThis, onAssess, onFixIssue, onClearIssue,
  issueContext, flashing, persistedGroundingFlags,
  triggerDraftNonce, excerptHint, onDraftDone,
}: {
  caseId: string;
  narrativeId: string;
  section: NarrativeRequirement["outline"][number];
  draft: string;
  onChange: (text: string) => void;
  onSave: (text: string) => void;
  assessment?: SectionAssessment;
  assessingThis: boolean;
  onAssess: () => void;
  onFixIssue: (fix: string) => void;
  onClearIssue: () => void;
  issueContext?: string;
  /** Briefly highlight this section after a jump (TOC / coherence click) */
  flashing?: boolean;
  persistedGroundingFlags?: Array<{ text: string; reason: string; severity: "error" | "warning"; start?: number; end?: number }>;
  /** When this increments, auto-trigger a draft (used by draft-all flow) */
  triggerDraftNonce?: number;
  /** Previous sections' excerpts for evidence dedup hint */
  excerptHint?: ExcerptHint;
  /** Called after a draft completes (used by draft-all flow) */
  onDraftDone?: () => void;
}) {
  const [draftState, setDraftState] = useState<DraftState>("idle");
  const [draftError, setDraftError] = useState("");
  const [showGuidance, setShowGuidance] = useState(false);
  // Feedback is collapsed by default so the prose dominates; expand on demand.
  const [showAssessment, setShowAssessment] = useState(false);
  const [showGrounding, setShowGrounding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [groundingFlags, setGroundingFlags] = useState<Array<{ text: string; reason: string; severity: "error" | "warning"; start?: number; end?: number }>>(persistedGroundingFlags ?? []);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea to fit its content so sections read as one
  // continuous document rather than fixed-height scroll boxes.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  const handleChange = (val: string) => {
    onChange(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => onSave(val), 800);
  };

  const handleFindInDraft = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const idx = draft.indexOf(text);
    if (idx === -1) return;
    el.focus();
    el.setSelectionRange(idx, idx + text.length);
    el.scrollTop = Math.max(0, el.scrollHeight * (idx / Math.max(draft.length, 1)) - 60);
  };

  // Stable ref so the nonce-trigger effect can call the latest version without re-running
  const doDraftRef = useRef<(fixIssue?: string, hints?: ExcerptHint) => Promise<void>>(async () => {});

  const doDraft = async (fixIssue?: string, hints?: ExcerptHint) => {
    setDraftState("generating");
    setDraftError("");
    setGroundingFlags([]);
    setElapsed(0);
    elapsedTimer.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    let accumulated = "";
    try {
      const body: Record<string, unknown> = {};
      if (fixIssue) body.issueContext = fixIssue;
      const activeHints = hints ?? excerptHint;
      if (activeHints && activeHints.length > 0) body.previousDraftExcerpts = activeHints;
      const res = await fetch(`/api/cases/${caseId}/brief/${narrativeId}/${section.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...settingsHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok || !res.body) { setDraftError("Draft failed — check LLM server."); setDraftState("error"); onDraftDone?.(); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.t === "c") { accumulated += evt.v; onChange(accumulated); }
            // Clear the prior assessment after ANY regeneration — a plain
            // Redraft makes the old "Fixing" issues stale too, not just a Fix.
            else if (evt.t === "done") { onSave(accumulated); setDraftState("done"); onClearIssue(); onDraftDone?.(); }
            else if (evt.t === "grounding") { const fl = evt.flags ?? []; setGroundingFlags(fl); setShowGrounding(fl.length > 0); }
            else if (evt.t === "error") { setDraftError(evt.m); setDraftState("error"); onDraftDone?.(); }
          } catch { /* skip */ }
        }
      }
    } catch (e) {
      setDraftError(e instanceof Error ? e.message : "Unknown error");
      setDraftState("error");
      onDraftDone?.();
    } finally {
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    }
  };

  doDraftRef.current = doDraft;

  // Auto-trigger when parent increments triggerDraftNonce (draft-all flow)
  useEffect(() => {
    if (triggerDraftNonce && triggerDraftNonce > 0) {
      doDraftRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerDraftNonce]);

  const words = wc(draft);
  const isGenerating = draftState === "generating";
  const isReady = assessment?.ready ?? false;

  return (
    <section
      id={`section-${section.id}`}
      className={`scroll-mt-20 border-b border-border-subtle pb-8 transition-colors duration-700 ${
        flashing ? "rounded-lg bg-info-soft ring-1 ring-info-border" : "bg-transparent"
      }`}
    >
      {/* ── Section header: typographic h2 + one quiet action cluster ── */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="font-serif text-2xl text-text-primary flex items-center gap-2.5 leading-tight min-w-0">
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
            isReady ? "bg-success-fill" : issueContext ? "bg-warning-fill" : words > 0 ? "bg-surface-inverted" : "bg-border-default"
          }`} />
          <span className="truncate">{section.heading}</span>
        </h2>
        <div className="flex items-center gap-1 shrink-0 pt-1">
          {isGenerating ? (
            <span className="flex items-center gap-1 text-xs text-text-muted px-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted" />
              {elapsed < 5 ? "Drafting…" : `${elapsed}s`}
            </span>
          ) : assessingThis ? (
            <span className="flex items-center gap-1 text-xs text-text-muted px-2">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-info-fill" />
              Assessing…
            </span>
          ) : words === 0 ? (
            issueContext ? (
              <>
                <button type="button" className="btn btn-primary text-xs" onClick={() => doDraft(issueContext)}>Fix issue</button>
                <button type="button" className="btn btn-ghost text-xs" onClick={() => doDraft()}>Redraft</button>
              </>
            ) : (
              <button type="button" className="btn btn-primary text-xs" onClick={() => doDraft()}>Draft section</button>
            )
          ) : (
            <>
              <span className="text-xs tabular-nums text-text-muted px-1">{words.toLocaleString()} w</span>
              {issueContext && <button type="button" className="btn btn-primary text-xs" onClick={() => doDraft(issueContext)}>Fix issue</button>}
              <button type="button" className="btn btn-ghost text-xs" onClick={() => doDraft()}>Redraft</button>
              <button type="button" className="btn btn-ghost text-xs" onClick={onAssess}>{assessment ? "Re-assess" : "Assess"}</button>
              <button type="button" className="btn btn-ghost text-xs px-2" onClick={() => setShowGuidance((g) => !g)} title="Drafting guidance">?</button>
            </>
          )}
        </div>
      </div>

      {/* ── Section body ── */}
      <div className="space-y-3">

            {/* Guidance (on demand) */}
            {showGuidance && (
              <div className="rounded-lg bg-surface-subtle border border-border-subtle px-4 py-3 text-xs text-text-secondary leading-relaxed">
                {section.guidance}
              </div>
            )}

            {/* Fix-mode banner (compact) */}
            {issueContext && (
              <div className="flex items-start justify-between gap-3 rounded-md border border-warning-border bg-warning-bg px-3 py-2">
                <p className="text-xs text-warning-text leading-relaxed"><span className="font-semibold">Fixing: </span>{issueContext}</p>
                <button type="button" className="shrink-0 text-xs text-warning-fill hover:text-warning-text" onClick={onClearIssue}>Dismiss</button>
              </div>
            )}

            {/* Textarea — auto-grows to content (continuous-document feel) */}
            <HighlightedTextarea
              ref={textareaRef}
              className="input min-h-[140px] font-serif text-base leading-relaxed overflow-hidden resize-none"
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={`Draft for "${section.heading}" will appear here…`}
            />

            {isGenerating && elapsed >= 10 && (
              <p className="text-xs text-text-muted">{elapsed < 30 ? "Processing…" : "Generating — text streams in as it arrives."}</p>
            )}
            {draftError && <p className="text-xs text-danger-fill">{draftError}</p>}

            {/* ── Grounding issues — collapsed summary, expand on demand ── */}
            {groundingFlags.length > 0 && (() => {
              const errCount = groundingFlags.filter(f => f.severity === "error").length;
              const warnCount = groundingFlags.length - errCount;
              return (
                <div className="rounded-md border border-danger-border bg-danger-bg overflow-hidden">
                  <button type="button" className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setShowGrounding(s => !s)}>
                    <span className="text-xs font-medium text-danger-text">
                      ⚠ {errCount > 0 && `${errCount} unverified claim${errCount !== 1 ? "s" : ""}`}{errCount > 0 && warnCount > 0 ? " · " : ""}{warnCount > 0 && `${warnCount} warning${warnCount !== 1 ? "s" : ""}`}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-danger-fill shrink-0">
                      {showGrounding ? "Hide" : "Review"}
                      <svg className={`h-3.5 w-3.5 transition-transform ${showGrounding ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </button>
                  {showGrounding && (
                    <ul className="space-y-1.5 px-3 pb-3 pt-1 border-t border-danger-border">
                      {groundingFlags.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-danger-text">
                          <span className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase ${f.severity === "error" ? "bg-danger-border text-danger-text" : "bg-warning-border text-warning-text"}`}>{f.severity}</span>
                          <span className="flex-1"><span className="font-medium">&ldquo;{f.text}&rdquo;</span>{" — "}{f.reason}</span>
                          <button type="button" className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono text-text-muted hover:bg-surface-muted hover:text-text-secondary" onClick={() => handleFindInDraft(f.text)} title="Jump to this text in the draft">Find ↗</button>
                          <button type="button" className="shrink-0 text-danger-fill hover:text-danger-fill" onClick={() => setGroundingFlags(prev => prev.filter((_, j) => j !== i))} title="Ignore this flag">✕</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })()}

            {/* ── Assessment — collapsed summary, expand on demand ── */}
            {assessment && !assessingThis && (() => {
              const failed = assessment.criteria.filter(c => !c.passed).length;
              return (
                <div className="rounded-md border border-border-subtle bg-surface-subtle overflow-hidden">
                  <button type="button" className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left" onClick={() => setShowAssessment(s => !s)}>
                    <span className="flex items-center gap-2 min-w-0">
                      <ScoreBadge score={assessment.score} />
                      {assessment.ready
                        ? <span className="text-xs font-medium text-success-text">Ready ✓</span>
                        : <span className="text-xs text-text-muted truncate">{failed > 0 ? `${failed} check${failed !== 1 ? "s" : ""} need work` : "Needs work"}{assessment.issues.length > 0 ? ` · ${assessment.issues.length} issue${assessment.issues.length !== 1 ? "s" : ""}` : ""}</span>}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-text-muted shrink-0">
                      {showAssessment ? "Hide" : "Review"}
                      <svg className={`h-3.5 w-3.5 transition-transform ${showAssessment ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </span>
                  </button>
                  {showAssessment && (
                    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-border-subtle">
                      <div className="space-y-2">
                        {assessment.criteria.map((c, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className={`mt-0.5 shrink-0 text-sm ${c.passed ? "text-success-fill" : "text-danger-fill"}`}>{c.passed ? "✓" : "✗"}</span>
                            <div className="min-w-0">
                              <p className={`text-xs leading-snug ${c.passed ? "text-text-secondary" : "text-text-primary font-medium"}`}>{c.label}</p>
                              {c.notes && !c.passed && <p className="mt-0.5 text-xs text-text-muted leading-snug">{c.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                      {assessment.issues.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Issues</p>
                          {assessment.issues.map((issue, i) => (
                            <div key={i} className="rounded-md border border-warning-border bg-warning-bg px-3 py-2.5 space-y-1">
                              <p className="text-xs font-mono text-text-muted line-clamp-1">{issue.excerpt}</p>
                              <p className="text-xs font-medium text-warning-text">{issue.problem}</p>
                              <p className="text-xs text-text-muted leading-snug">→ {issue.fix}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
      </div>{/* end section body */}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Coherence block (exported so LetterEditor can render it below the letter)
// ---------------------------------------------------------------------------

export function CoherenceBlock({ caseId, narrativeId, draftedCount, totalSections, initialReport, headers, outline, onJumpToSection, compact }: {
  caseId: string;
  narrativeId: string;
  draftedCount: number;
  totalSections: number;
  initialReport?: CoherenceReport;
  headers: HeadersInit;
  /** Section outline — used to resolve display names back to section IDs for jump links */
  outline?: NarrativeRequirement["outline"];
  /** Called when the attorney clicks a contradiction/transition to jump to the section */
  onJumpToSection?: (sectionId: string) => void;
  /** Compact mode: smaller headings, used inside the InsightsPanel drawer */
  compact?: boolean;
}) {
  const [report, setReport] = useState<CoherenceReport | undefined>(initialReport);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setRunning(true);
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/brief/${narrativeId}/coherence`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers as Record<string, string>) },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setReport(data as CoherenceReport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coherence check failed");
    } finally {
      setRunning(false);
    }
  };

  /** Fuzzy-match a display name from the coherence report to a section ID */
  const resolveSection = (label: string): string | null => {
    if (!outline) return null;
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(label);
    const match = outline.find(s =>
      norm(s.heading).includes(target) || target.includes(norm(s.heading)) || norm(s.id).includes(target)
    );
    return match?.id ?? null;
  };

  const enough = draftedCount >= 3;
  const px = compact ? "px-3 py-3" : "px-5 py-5";

  return (
    <div className={`${compact ? "" : "rounded-xl border border-border-default bg-surface-card shadow-sm"} ${px} space-y-4`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {compact
            ? <span className="text-sm font-semibold text-text-primary">Coherence Check</span>
            : <h3 className="font-serif text-lg">Coherence Check</h3>}
          {report && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              report.score >= 80 ? "bg-success-soft text-success-text"
              : report.score >= 60 ? "bg-warning-soft text-warning-text"
              : "bg-danger-soft text-danger-text"
            }`}>{report.score}/100</span>
          )}
          {report?.readyToFile && (
            <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-text">Ready to file</span>
          )}
        </div>
        <button type="button" className={`btn btn-primary ${compact ? "text-xs" : "text-sm"}`} onClick={run} disabled={running || !enough}>
          {running ? "Checking…" : report ? "Re-check" : "Run check"}
        </button>
      </div>

      {!enough && (
        <p className="text-xs text-text-muted">Draft at least 3 sections to run a coherence check.</p>
      )}
      {enough && !report && !running && (
        <p className="text-xs text-text-muted">
          Checks narrative arc, voice consistency, argument progression, redundancy, and Dhanasar coverage.
        </p>
      )}

      {running && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-text-muted" />
          Reading the brief as a whole…
        </div>
      )}
      {error && <p className="text-xs text-danger-fill">{error}</p>}

      {report && !running && (
        <div className="space-y-4">
          {/* Dimension bars */}
          <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
            {report.dimensions.map((d, i) => (
              <div key={i}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">{d.label}</span>
                  <span className="text-xs tabular-nums text-text-muted">{d.score}</span>
                </div>
                <Bar score={d.score} />
                {d.notes && <p className="mt-0.5 text-xs text-text-muted leading-snug">{d.notes}</p>}
              </div>
            ))}
          </div>

          {/* Contradictions — clickable when onJumpToSection available */}
          {report.contradictions.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger-fill">Contradictions</p>
              <div className="space-y-2">
                {report.contradictions.map((c, i) => {
                  const sectionAId = resolveSection(c.sectionA);
                  const sectionBId = resolveSection(c.sectionB);
                  const canJump = !!(onJumpToSection && (sectionAId || sectionBId));
                  return (
                    <div
                      key={i}
                      className={`rounded-md border border-danger-border bg-danger-bg px-3 py-2.5 ${canJump ? "cursor-pointer hover:border-danger-fill" : ""}`}
                      onClick={() => {
                        if (!canJump) return;
                        const id = sectionAId ?? sectionBId!;
                        onJumpToSection!(id);
                      }}
                      title={canJump ? `Click to jump to ${c.sectionA}` : undefined}
                    >
                      <p className="text-xs font-medium text-danger-text">
                        {canJump && <span className="mr-1 text-danger-fill">↗</span>}
                        {c.sectionA} ↔ {c.sectionB}
                      </p>
                      <p className="mt-1 text-xs text-danger-fill">{c.issue}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Transition issues — clickable */}
          {report.transitionIssues.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Transition Issues</p>
              <div className="space-y-2">
                {report.transitionIssues.map((t, i) => {
                  // "between" is like "Introduction → Prong 1" — resolve the first section name
                  const firstName = t.between.split(/[→↔]/)[0].trim();
                  const sectionId = resolveSection(firstName);
                  const canJump = !!(onJumpToSection && sectionId);
                  return (
                    <div
                      key={i}
                      className={`rounded-md border border-border-subtle bg-surface-subtle px-3 py-2.5 ${canJump ? "cursor-pointer hover:border-border-strong" : ""}`}
                      onClick={() => { if (canJump) onJumpToSection!(sectionId!); }}
                      title={canJump ? `Click to jump to ${firstName}` : undefined}
                    >
                      <p className="text-xs font-medium text-text-secondary">
                        {canJump && <span className="mr-1 text-text-muted">↗</span>}
                        {t.between}
                      </p>
                      <p className="mt-0.5 text-xs text-text-muted">{t.issue}</p>
                      <p className="mt-1 text-xs text-text-muted italic">→ {t.suggestion}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main editor
// ---------------------------------------------------------------------------

export type EditorHandle = { jumpToSection: (sectionId: string, issue?: string) => void };

export const PetitionBriefEditor = forwardRef<EditorHandle, Props>(function PetitionBriefEditor({ caseId, narrative, initialDrafts, initialAssessments, initialGroundingFlags, initialCoherence, onAssemble, hideCoherence, onDraftedCountChange }: Props, ref) {
  const [drafts, setDrafts] = useState<SectionDrafts>(initialDrafts);
  const draftsRef = useRef<SectionDrafts>(initialDrafts);
  const [copying, setCopying] = useState(false);
  const [sectionAssessments, setSectionAssessments] = useState<SectionAssessments>(initialAssessments ?? {});
  const [assessingSection, setAssessingSection] = useState<string | null>(null);
  const [issueContexts, setIssueContexts] = useState<Record<string, string>>(deriveIssueContexts(initialAssessments ?? {}));
  // Scroll-spy: which section is currently in view (drives TOC highlight).
  const [activeSectionId, setActiveSectionId] = useState<string>(narrative.outline[0]?.id ?? "");
  // Transient flash on a section after a jump (TOC / coherence click).
  const [flashSectionId, setFlashSectionId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalWords = Object.values(drafts).reduce((sum, t) => sum + wc(t), 0);
  const draftedCount = narrative.outline.filter((s) => wc(drafts[s.id] ?? "") > 0).length;
  const readyCount = narrative.outline.filter((s) => sectionAssessments[s.id]?.ready).length;

  useEffect(() => { onDraftedCountChange?.(draftedCount); }, [draftedCount, onDraftedCountChange]);

  const saveSectionDraft = useCallback((sectionId: string, text: string) => {
    const next = { ...draftsRef.current, [sectionId]: text };
    draftsRef.current = next;
    setDrafts(next);
    fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formData: { narrativeDrafts: { [narrative.id]: next } } }),
    });
    onAssemble?.(assembleBrief(narrative.outline, next));
  }, [caseId, narrative.id, narrative.outline, onAssemble]);

  const assessSection = useCallback(async (sectionId: string) => {
    setAssessingSection(sectionId);
    try {
      const res = await fetch(`/api/cases/${caseId}/brief/${narrative.id}/${sectionId}/assess`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...settingsHeaders() },
      });
      const data = await res.json();
      if (res.ok) {
        const assessment = data as SectionAssessment;
        setSectionAssessments((prev) => ({ ...prev, [sectionId]: assessment }));
        if (!assessment.ready && assessment.issues.length > 0) {
          setIssueContexts((prev) => ({ ...prev, [sectionId]: compiledIssueContext(assessment) }));
        } else {
          setIssueContexts((prev) => { const n = { ...prev }; delete n[sectionId]; return n; });
        }
      }
    } finally {
      setAssessingSection(null);
    }
  }, [caseId, narrative.id]);

  const jumpToSection = useCallback((sectionId: string, issue?: string) => {
    if (issue) setIssueContexts((prev) => ({ ...prev, [sectionId]: issue }));
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Flash the target so the eye lands on the right spot (Ticket 4 bonus).
    setFlashSectionId(sectionId);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashSectionId(null), 1000);
  }, []);

  useImperativeHandle(ref, () => ({ jumpToSection }), [jumpToSection]);

  // Scroll-spy — highlight the TOC entry for whichever section is in view.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^section-/, "");
          if (id) setActiveSectionId(id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
    );
    narrative.outline.forEach((s) => {
      const el = document.getElementById(`section-${s.id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [narrative.outline]);

  const copyFullBrief = async () => {
    const full = narrative.outline
      .map((s) => { const t = drafts[s.id]?.trim(); return t ? `## ${s.heading}\n\n${t}` : null; })
      .filter(Boolean).join("\n\n---\n\n");
    if (!full) return;
    setCopying(true);
    await navigator.clipboard.writeText(full).catch(() => {});
    setTimeout(() => setCopying(false), 1500);
  };

  // Download the assembled brief as a white-label PDF or DOCX (server-rendered
  // from the saved narrativeDrafts). Uses an anchor click so the attachment
  // downloads without navigating away from the workspace.
  const downloadBrief = (format: "pdf" | "docx") => {
    const a = document.createElement("a");
    a.href = `/api/cases/${caseId}/brief/${narrative.id}/export?format=${format}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // ── Draft-all orchestration (E1.3) ──────────────────────────────────────
  const CONCURRENCY = 3;
  const [draftAllNonces, setDraftAllNonces] = useState<Record<string, number>>({});
  const [draftAllExcerpts, setDraftAllExcerpts] = useState<Record<string, ExcerptHint>>({});
  const [draftAllRunning, setDraftAllRunning] = useState(false);
  const [draftAllCompleted, setDraftAllCompleted] = useState(0);
  const [draftAllTotal, setDraftAllTotal] = useState(0);
  const draftAllQueueRef = useRef<string[]>([]);
  const draftAllActiveRef = useRef<Set<string>>(new Set());

  const startNextBatch = useCallback(() => {
    const queue = draftAllQueueRef.current;
    const active = draftAllActiveRef.current;
    const canStart = CONCURRENCY - active.size;
    if (canStart <= 0) return;
    const toStart = queue.splice(0, canStart);
    if (toStart.length === 0) {
      if (active.size === 0) setDraftAllRunning(false);
      return;
    }
    toStart.forEach(id => active.add(id));
    // Build excerpt hints from all preceding sections' current drafts
    const newExcerpts: Record<string, ExcerptHint> = {};
    toStart.forEach(id => {
      const idx = narrative.outline.findIndex(s => s.id === id);
      newExcerpts[id] = narrative.outline
        .slice(0, idx)
        .filter(s => draftsRef.current[s.id]?.trim())
        .map(s => ({ heading: s.heading, excerpt: draftsRef.current[s.id].slice(0, 200) }));
    });
    setDraftAllExcerpts(prev => ({ ...prev, ...newExcerpts }));
    setDraftAllNonces(prev => {
      const next = { ...prev };
      toStart.forEach(id => { next[id] = (prev[id] ?? 0) + 1; });
      return next;
    });
  }, [narrative.outline]);

  const handleSectionDraftDone = useCallback((sectionId: string) => {
    draftAllActiveRef.current.delete(sectionId);
    setDraftAllCompleted(n => n + 1);
    startNextBatch();
  }, [startNextBatch]);

  const undraftedSections = narrative.outline.filter(s => wc(drafts[s.id] ?? "") === 0);

  const draftAllSections = useCallback(() => {
    const toRun = undraftedSections.map(s => s.id);
    if (toRun.length === 0) return;
    draftAllQueueRef.current = toRun;
    draftAllActiveRef.current = new Set();
    setDraftAllRunning(true);
    setDraftAllCompleted(0);
    setDraftAllTotal(toRun.length);
    startNextBatch();
  }, [undraftedSections, startNextBatch]);

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-serif text-xl">{narrative.title}</h2>
          <p className="mt-0.5 text-sm text-text-muted">
            {draftedCount}/{narrative.outline.length} drafted
            {readyCount > 0 && <span className="text-success-text"> · {readyCount} ready</span>}
            {totalWords > 0 && ` · ${totalWords.toLocaleString()} words`}
            {narrative.targetLength && (
              <span className="text-text-muted"> (target {narrative.targetLength.minWords.toLocaleString()}–{narrative.targetLength.maxWords.toLocaleString()})</span>
            )}
            {draftAllRunning && (
              <span className="text-info-text"> · Auto-drafting {draftAllCompleted}/{draftAllTotal}…</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {undraftedSections.length > 0 && !draftAllRunning && (
            <button type="button" className="btn btn-primary text-sm" onClick={draftAllSections}>
              Draft all ({undraftedSections.length})
            </button>
          )}
          {draftAllRunning && (
            <button type="button" className="btn btn-secondary text-sm" disabled>
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-text-muted mr-2" />
              {draftAllCompleted}/{draftAllTotal}
            </button>
          )}
          {totalWords > 0 && (
            <>
              <button type="button" className="btn btn-secondary text-sm" onClick={copyFullBrief}>
                {copying ? "Copied!" : "Copy full brief"}
              </button>
              <button type="button" className="btn btn-secondary text-sm" onClick={() => downloadBrief("pdf")}>
                Download PDF
              </button>
              <button type="button" className="btn btn-secondary text-sm" onClick={() => downloadBrief("docx")}>
                Download DOCX
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div className="h-1.5 w-full rounded-full bg-surface-muted">
        <div className="h-1.5 rounded-full bg-surface-inverted transition-all" style={{ width: `${(draftedCount / narrative.outline.length) * 100}%` }} />
      </div>

      {/* ── Main body: sticky TOC sidebar + section cards ── */}
      <div className="flex gap-6 items-start">

        {/* Left sticky TOC — hidden on small screens */}
        <nav className="hidden lg:flex lg:flex-col gap-0.5 w-44 shrink-0 sticky top-4 self-start">
          {narrative.outline.map((s) => {
            const drafted = wc(drafts[s.id] ?? "") > 0;
            const ready = sectionAssessments[s.id]?.ready;
            const score = sectionAssessments[s.id]?.score;
            const hasIssue = !!issueContexts[s.id];
            const isActive = activeSectionId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => jumpToSection(s.id)}
                aria-current={isActive ? "true" : undefined}
                className={`group flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors border-l-2 ${
                  isActive ? "border-brand-primary" : "border-transparent"
                } ${
                  ready ? "bg-success-bg text-success-text hover:bg-success-soft"
                  : hasIssue ? "bg-warning-bg text-warning-text hover:bg-warning-soft"
                  : isActive ? "bg-surface-muted text-text-primary font-medium"
                  : drafted ? "text-text-secondary hover:bg-surface-muted"
                  : "text-text-muted hover:bg-surface-subtle"
                }`}
              >
                {/* Status dot */}
                <span className={`h-2 w-2 shrink-0 rounded-full border ${
                  ready ? "border-success-fill bg-success-fill"
                  : hasIssue ? "border-warning-fill bg-warning-bg"
                  : drafted ? "border-border-inverted bg-surface-inverted"
                  : "border-border-default"
                }`} />
                {/* Section label — truncated */}
                <span className="flex-1 truncate leading-tight">{s.heading}</span>
                {/* Score */}
                {score !== undefined && !ready && (
                  <span className="text-[10px] tabular-nums text-text-muted shrink-0">{score}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Section cards + coherence — continuous vertical document */}
        <div className="flex-1 min-w-0 space-y-10">
          {narrative.outline.map((section) => (
            <SectionCard
              key={section.id}
              caseId={caseId}
              narrativeId={narrative.id}
              section={section}
              draft={drafts[section.id] ?? ""}
              onChange={(text) => setDrafts((prev) => ({ ...prev, [section.id]: text }))}
              onSave={(text) => saveSectionDraft(section.id, text)}
              assessment={sectionAssessments[section.id]}
              assessingThis={assessingSection === section.id}
              onAssess={() => assessSection(section.id)}
              onFixIssue={(fix) => {
                setIssueContexts((prev) => ({ ...prev, [section.id]: fix }));
              }}
              onClearIssue={() => setIssueContexts((prev) => { const n = { ...prev }; delete n[section.id]; return n; })}
              issueContext={issueContexts[section.id]}
              flashing={flashSectionId === section.id}
              persistedGroundingFlags={initialGroundingFlags?.[section.id]}
              triggerDraftNonce={draftAllNonces[section.id]}
              excerptHint={draftAllExcerpts[section.id]}
              onDraftDone={() => handleSectionDraftDone(section.id)}
            />
          ))}

          {/* ── Coherence check (suppressed when parent renders it elsewhere) ── */}
          {!hideCoherence && draftedCount >= 1 && (
            <CoherenceBlock
              caseId={caseId}
              narrativeId={narrative.id}
              draftedCount={draftedCount}
              totalSections={narrative.outline.length}
              initialReport={initialCoherence}
              headers={settingsHeaders()}
              outline={narrative.outline}
              onJumpToSection={jumpToSection}
            />
          )}
        </div>
      </div>
    </div>
  );
});
