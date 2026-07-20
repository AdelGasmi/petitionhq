"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Case, LetterRecord } from "@/lib/db";
import type { FormConfig, DocumentRequirement } from "@/forms/types";
import { settingsHeaders } from "@/lib/settings";
import { validateFormData } from "@/lib/formValidation";
import { letterQualityFor, type LetterQuality } from "@/lib/scoring";
import { MessagesTab } from "@/components/MessagesTab";
import { SectionComments } from "@/components/SectionComments";
import { LlmSettingsPanel } from "@/components/LlmSettingsPanel";
import { Modal, ModalFooter } from "@/components/ui/Modal";
import { RecommenderCombobox } from "@/components/RecommenderCombobox";
import { PetitionMark } from "@/components/icons/PetitionMark";
import { Check } from "@/components/icons";
import { Tabs, type TabItem } from "@/components/ui/Tabs";

import { toCamelCase, FieldEditor } from "@/components/case/FieldRenderers";
import { DocCard, type DocCardState } from "@/components/case/DocCard";
import { PdfDownloadButton, CompanionFilingBanner } from "@/components/case/CompanionBanner";
import {
  ApplicantStatusBanner,
  ApplicantRecommendersView,
  ApplicantProfileView,
  IntakeLinkPanel,
  ExhibitPlanPanel,
} from "@/components/case/ApplicantViews";

type CompanionCase = { formId: string; caseId: string | null };

type Props = {
  initialCase: Case;
  form: FormConfig;
  currentUserId: string;
  currentUserRole: "admin" | "attorney" | "applicant";
  /** Magic-link applicants — strip the dashboard chrome, just let them fill the form. */
  isGuest?: boolean;
  companionCases?: CompanionCase[];
  canCreateMore?: boolean;
  canDownloadPdf?: boolean;
  /** Self-petitioner beta: owner flagged into the drafting unlock (lib/auth.ts canDraftCase). */
  canDraft?: boolean;
};

type Tab = "data" | "docs" | "letters" | "recommenders" | "messages" | "exhibit";
type SaveState = "idle" | "saving" | "saved" | "error" | "locked";

// Letter-quality thresholds live in lib/scoring (letterQualityFor); this maps
// the resolved level to the chip color. Visual output unchanged — raw palette
// classes migrate to tokens in T2-3.
const LETTER_CHIP: Record<LetterQuality, string> = {
  excellent: "bg-success-soft text-success-text",
  acceptable: "bg-warning-soft text-warning-text",
  "needs-work": "bg-danger-soft text-danger-text",
};

export function CaseWorkspace({ initialCase, form, currentUserId, currentUserRole, isGuest = false, companionCases, canCreateMore, canDownloadPdf, canDraft = false }: Props) {
  const router = useRouter();
  const isApplicant = currentUserRole === "applicant";
  // Magic-link applicants get the raw form editor, not the dashboard summary —
  // they're here to fill in data, not to look at a progress page.
  const useApplicantSummary = isApplicant && !isGuest;
  // Beta-flagged applicant owners get the full letters/brief management tab,
  // same as an attorney — everyone else on the applicant role gets the
  // read-only recommenders view.
  const showLetters = !isApplicant || canDraft;

  // Tab set depends on role; computed each render (depends only on props).
  const tabList: TabItem[] = [
    { id: "data", label: useApplicantSummary ? "My profile" : "Form data" },
    { id: "docs", label: "Documents" },
    ...(isGuest
      ? []
      : showLetters
      ? [{ id: "letters", label: "Letters" }]
      : [{ id: "recommenders", label: "Recommenders" }]),
    { id: "messages", label: "Messages" },
    ...(!isApplicant ? [{ id: "exhibit", label: "Exhibit plan" }] : []),
  ];

  // ?tab= deep-link + refresh persistence (DESIGN.md §3.11).
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => {
    const p = searchParams.get("tab");
    return p && tabList.some((t) => t.id === p) ? (p as Tab) : "data";
  });
  const selectTab = useCallback(
    (id: string) => {
      setTab(id as Tab);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", id);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // ----- Form data tab -----
  const [formData, setFormData] = useState<Record<string, unknown>>(
    initialCase.formData
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  // Once a filed/locked (409) case is hit, stop autosaving entirely — further
  // edits cannot be persisted, so silently retrying would mask the data loss.
  const lockedRef = useRef(false);

  // §5.5 autosave contract: a failed PATCH must surface a persistent error +
  // manual retry, never silently return to idle. Reads the latest formData via
  // closure (re-created on every edit), so retry always resends current state.
  const saveFormData = useCallback(async () => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/cases/${initialCase.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...settingsHeaders(),
        },
        body: JSON.stringify({ formData }),
      });
      if (res.status === 409) {
        lockedRef.current = true;
        setSaveState("locked");
        return;
      }
      if (!res.ok) {
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      setTimeout(() => setSaveState((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch {
      setSaveState("error");
    }
  }, [formData, initialCase.id]);

  const [validation, setValidation] = useState(() => validateFormData(form, formData));
  useEffect(() => {
    if (validationTimer.current) clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(() => {
      setValidation(validateFormData(form, formData));
    }, 600);
    return () => { if (validationTimer.current) clearTimeout(validationTimer.current); };
  }, [form, formData]);

  const updateField = useCallback(
    (sectionKey: string, fieldId: string, value: unknown) => {
      setFormData((prev) => {
        const section = (prev[sectionKey] as Record<string, unknown>) ?? {};
        return { ...prev, [sectionKey]: { ...section, [fieldId]: value } };
      });
    },
    []
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (lockedRef.current) return; // filed case — never autosave again
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveFormData(); }, 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [formData, saveFormData]);

  // Unload guard: warn before closing the tab while a save is pending or failed.
  useEffect(() => {
    if (saveState !== "saving" && saveState !== "error") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveState]);

  // ----- Documents tab -----
  const [docStatuses, setDocStatuses] = useState<Record<string, DocCardState>>(
    () => {
      const result: Record<string, DocCardState> = {};
      for (const doc of form.documents) {
        const existing = initialCase.documents[doc.id];
        result[doc.id] = {
          status: existing?.status ?? "missing",
          notes: existing?.notes ?? "",
          filename: existing?.filename,
          size: existing?.size,
          mimeType: existing?.mimeType,
        };
      }
      return result;
    }
  );

  const patchDoc = async (docId: string, patch: Record<string, unknown>) => {
    await fetch(`/api/cases/${initialCase.id}/documents/${docId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...settingsHeaders(),
      },
      body: JSON.stringify(patch),
    });
  };

  const requiredDocCount = form.documents.filter((d) => d.required).length;
  const haveRequiredCount = form.documents.filter(
    (d) => d.required && docStatuses[d.id]?.status === "uploaded"
  ).length;

  const groupedDocs = (() => {
    const groups: Record<string, DocumentRequirement[]> = { General: [] };
    for (const doc of form.documents) {
      const key = doc.prong ? `Prong ${doc.prong}` : "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(doc);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0));
    }
    return groups;
  })();

  // ----- Letters tab -----
  const [newLetterFor, setNewLetterFor] = useState<{
    requirementId: string;
    title: string;
    defaultKind: "independent" | "dependent" | "governmental";
  } | null>(null);
  const [newRec, setNewRec] = useState({
    name: "",
    title: "",
    institution: "",
    credentials: "",
    relationship: "",
    kind: "independent" as "independent" | "dependent" | "governmental",
  });
  const [creatingLetter, setCreatingLetter] = useState(false);

  const openModal = (
    requirementId: string,
    title: string,
    kind: "independent" | "dependent" | "governmental"
  ) => {
    setNewLetterFor({ requirementId, title, defaultKind: kind });
    setNewRec({
      name: "",
      title: "",
      institution: "",
      credentials: "",
      relationship: "",
      kind,
    });
  };

  const createLetter = async (overrideReqId?: string, overrideRec?: typeof newRec) => {
    const reqId = overrideReqId ?? newLetterFor?.requirementId;
    if (!reqId) return;
    setCreatingLetter(true);
    try {
      const res = await fetch(`/api/cases/${initialCase.id}/letters`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...settingsHeaders(),
        },
        body: JSON.stringify({
          requirementId: reqId,
          recommender: overrideRec ?? newRec,
        }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/cases/${initialCase.id}/letters/${data.id}`);
      }
    } catch {
      setCreatingLetter(false);
    }
  };

  // Recommenders the applicant entered during intake (StepRecommenders →
  // formData.recommenders[]). Lets the attorney pick instead of retyping.
  type IntakeRec = { name: string; title?: string; institution?: string; credentials?: string; relationship?: string; email?: string; kind?: "independent" | "dependent" };
  const intakeRecommenders = ((initialCase.formData as Record<string, unknown>).recommenders ?? []) as IntakeRec[];
  const usedRecommenderNames = new Set(
    Object.values(initialCase.letters)
      .map((l) => (l.recommender?.name ?? "").trim().toLowerCase())
      .filter(Boolean)
  );
  const selectIntakeRec = (r: IntakeRec) =>
    setNewRec({
      name: r.name ?? "",
      title: r.title ?? "",
      institution: r.institution ?? "",
      credentials: r.credentials ?? "",
      relationship: r.relationship ?? "",
      kind: (r.kind ?? newLetterFor?.defaultKind ?? "independent") as "independent" | "dependent" | "governmental",
    });

  const lettersByReq = (reqId: string): LetterRecord[] =>
    Object.values(initialCase.letters).filter(
      (l) => l.requirementId === reqId
    );

  // ----- Render -----
  return (
    <div className="space-y-6">
      {/* Companion filing banner — I-485 only, hidden from magic-link applicants */}
      {!isGuest && companionCases && companionCases.length > 0 && (
        <CompanionFilingBanner companions={companionCases} canCreate={canCreateMore ?? false} />
      )}

      {/* Intake link panel — NIW cases, attorney only (admin gets 403 from the API) */}
      {initialCase.formId === "i140-niw" && currentUserRole === "attorney" && (
        <IntakeLinkPanel caseId={initialCase.id} />
      )}

      {/* Applicant status banner — hidden from magic-link applicants and beta
          self-drafters (its "Attorney matched" step would misrepresent the
          founder's internal concierge account as a real reviewing attorney). */}
      {isApplicant && !isGuest && !canDraft && <ApplicantStatusBanner c={initialCase} />}

      {/* Tab bar */}
      <Tabs
        ariaLabel="Case sections"
        tabs={tabList}
        value={tab}
        onChange={selectTab}
        trailing={
          <div className="flex items-center gap-2 pr-1" role="status" aria-live="polite">
            {saveState === "saving" && <span className="text-xs text-text-muted">Saving...</span>}
            {saveState === "saved" && <span className="inline-flex items-center gap-1 text-xs text-text-muted">Saved <Check className="h-3 w-3" /></span>}
            {saveState === "error" && (
              <span className="text-xs text-danger-text">
                Couldn&apos;t save —{" "}
                <button type="button" onClick={() => saveFormData()} className="underline font-medium">retry</button>
              </span>
            )}
            {saveState === "locked" && (
              <span className="text-xs text-danger-text">This case is filed — content is locked.</span>
            )}
            {!isApplicant && <LlmSettingsPanel />}
          </div>
        }
      />

      {/* Profile / Form data */}
      {tab === "data" && useApplicantSummary && (
        <ApplicantProfileView caseId={initialCase.id} formData={initialCase.formData} onMerged={() => router.refresh()} canDownloadPdf={canDownloadPdf} />
      )}
      {tab === "data" && !useApplicantSummary && (
        <div className="space-y-10">
          <div className="flex items-center justify-between gap-4">
            {!isGuest && initialCase.formId === "i140-niw" && (
              <a
                href={`/cases/${initialCase.id}/intake`}
                className="flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-secondary hover:bg-surface-muted transition-colors"
              >
                <PetitionMark className="h-4 w-4 shrink-0 text-text-muted" />
                <span><span className="font-medium">Guided intake</span> — update your evidence profile</span>
              </a>
            )}
            {!isGuest && canDownloadPdf && (
              <div className="ml-auto">
                <PdfDownloadButton caseId={initialCase.id} canDownload />
              </div>
            )}
          </div>
          {(validation.errorCount > 0 || validation.warningCount > 0) && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${validation.errorCount > 0 ? "border-danger-border bg-danger-bg text-danger-text" : "border-warning-border bg-warning-bg text-warning-text"}`}>
              <p className="font-medium mb-2">
                {validation.errorCount > 0 && `${validation.errorCount} required field${validation.errorCount > 1 ? "s" : ""} missing`}
                {validation.errorCount > 0 && validation.warningCount > 0 && " · "}
                {validation.warningCount > 0 && `${validation.warningCount} warning${validation.warningCount > 1 ? "s" : ""}`}
              </p>
              <div className="flex flex-wrap gap-2">
                {form.sections.map((section) => {
                  const issues = validation.bySectionId[section.id] ?? [];
                  const errs = issues.filter(i => i.severity === "error").length;
                  const warns = issues.filter(i => i.severity === "warning").length;
                  if (errs === 0 && warns === 0) return null;
                  return (
                    <a
                      key={section.id}
                      href={`#section-${section.id}`}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold no-underline transition-opacity hover:opacity-80 ${errs > 0 ? "bg-danger-soft text-danger-text" : "bg-warning-soft text-warning-text"}`}
                    >
                      {section.title}
                      <span className="opacity-70">({errs > 0 ? `${errs} error${errs > 1 ? "s" : ""}` : `${warns} warning${warns > 1 ? "s" : ""}`})</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
          {form.sections.map((section) => {
            const sectionKey = toCamelCase(section.id);
            const sectionData =
              (formData[sectionKey] as Record<string, unknown>) ?? {};
            const sectionIssues = validation.bySectionId[section.id] ?? [];
            const sectionErrors = sectionIssues.filter(i => i.severity === "error").length;
            const sectionWarnings = sectionIssues.filter(i => i.severity === "warning").length;
            return (
              <div key={section.id} id={`section-${section.id}`} className="space-y-4 scroll-mt-24">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-xl">{section.title}</h3>
                    {sectionErrors > 0 && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger-text">{sectionErrors} error{sectionErrors > 1 ? "s" : ""}</span>}
                    {sectionWarnings > 0 && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">{sectionWarnings} warning{sectionWarnings > 1 ? "s" : ""}</span>}
                  </div>
                  {section.description && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {section.description}
                    </p>
                  )}
                  <SectionComments
                    caseId={initialCase.id}
                    sectionId={section.id}
                    initialComments={(initialCase.sectionComments ?? []).filter(
                      (c) => c.sectionId === section.id
                    )}
                    currentUserId={currentUserId}
                    currentUserRole={currentUserRole}
                  />
                </div>
                <div className="space-y-4">
                  {section.fields.map((field) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      value={sectionData[field.id]}
                      onChange={(v) => updateField(sectionKey, field.id, v)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Documents */}
      {tab === "docs" && (
        <div className="space-y-6">
          <p className="text-sm text-text-secondary">
            You have {haveRequiredCount} of {requiredDocCount} required documents.
          </p>
          {Object.entries(groupedDocs)
            .filter(([, docs]) => docs.length > 0)
            .map(([group, docs]) => (
              <div key={group} className="space-y-3">
                <h3 className="font-serif text-lg">{group}</h3>
                {docs.map((doc) => (
                  <DocCard
                    key={doc.id}
                    caseId={initialCase.id}
                    doc={doc}
                    state={
                      docStatuses[doc.id] ?? { status: "missing", notes: "" }
                    }
                    onChange={async (patch) => {
                      setDocStatuses((prev) => ({
                        ...prev,
                        [doc.id]: { ...prev[doc.id], ...patch },
                      }));
                      await patchDoc(doc.id, patch);
                    }}
                    onUploaded={(patch) => {
                      // Upload route already persisted the document state
                      // server-side, so just mirror locally.
                      setDocStatuses((prev) => ({
                        ...prev,
                        [doc.id]: { ...prev[doc.id], ...patch },
                      }));
                    }}
                  />
                ))}
              </div>
            ))}
        </div>
      )}

      {/* Recommenders — read-only applicant view (shows attorney-selected recommenders from letters) */}
      {tab === "recommenders" && isApplicant && !showLetters && (
        <ApplicantRecommendersView letters={initialCase.letters} />
      )}

      {/* Letters — attorney/admin full management, or a beta self-petitioner drafting their own case */}
      {tab === "letters" && showLetters && (
        <div className="space-y-10">
          {form.letters.map((req) => {
            const reqLetters = lettersByReq(req.id);
            const isPetition = req.kind === "petition-letter";
            const defaultKind = req.kind.includes("independent")
              ? "independent"
              : "dependent";
            const canAddMore = req.maxCount == null || reqLetters.length < req.maxCount;
            return (
              <div key={req.id} className="space-y-4">
                <div>
                  <h3 className="font-serif text-xl">{req.title}</h3>
                  {req.minCount != null && req.maxCount != null && (
                    <p className="mt-0.5 text-sm text-text-muted">
                      Need {req.minCount}–{req.maxCount} letter{req.maxCount > 1 ? "s" : ""}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-text-secondary">
                    {req.description}
                  </p>
                </div>
                {reqLetters.length > 0 && (
                  <div className="space-y-2">
                    {reqLetters.map((letter) => (
                      <div
                        key={letter.id}
                        className="card flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-sm font-medium">
                            {isPetition
                              ? req.title
                              : letter.recommender.name || "(unnamed)"}
                          </div>
                          {!isPetition && (
                            <div className="text-xs text-text-muted">
                              {letter.recommender.institution}
                            </div>
                          )}
                          {letter.currentDraft && (
                            <div className="text-xs text-text-muted">
                              {letter.currentDraft.split(/\s+/).filter(Boolean).length} words
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {letter.qualityReport && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${LETTER_CHIP[letterQualityFor(letter.qualityReport.overallScore)]}`}
                            >
                              {letter.qualityReport.overallScore}
                            </span>
                          )}
                          <a
                            href={`/cases/${initialCase.id}/letters/${letter.id}`}
                            className="text-sm text-text-muted hover:text-text-primary"
                          >
                            Open →
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {canAddMore && showLetters && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={creatingLetter}
                    onClick={() => {
                      if (isPetition) {
                        createLetter(req.id, {
                          name: "",
                          title: "",
                          institution: "",
                          credentials: "",
                          relationship: "",
                          kind: "dependent",
                        });
                      } else {
                        openModal(req.id, req.title, defaultKind);
                      }
                    }}
                  >
                    {creatingLetter ? "Creating..." : `New letter for ${req.title}`}
                  </button>
                )}
                {reqLetters.length === 0 && (
                  <p className="text-sm text-text-muted">No letters yet for this section.</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Exhibit plan */}
      {tab === "exhibit" && (
        <ExhibitPlanPanel caseId={initialCase.id} caseData={initialCase} letters={initialCase.letters} />
      )}

      {/* Messages */}
      {tab === "messages" && (
        <MessagesTab
          caseId={initialCase.id}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          hasAttorney={!!initialCase.attorneyId}
        />
      )}

      {/* New letter modal */}
      {newLetterFor && (
        <Modal
          open={!!newLetterFor}
          onClose={() => setNewLetterFor(null)}
          title={`New letter — ${newLetterFor.title}`}
          size="lg"
        >
            <div className="space-y-3">
              {/* Recommender name — ONE combobox: type a new name OR pick from intake */}
              <div>
                <label htmlFor="rec-name" className="block text-sm font-medium text-text-secondary">
                  Recommender name
                </label>
                {intakeRecommenders.length > 0 ? (
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    {intakeRecommenders.length} from intake ({intakeRecommenders.filter((r) => r.kind === "independent").length} independent · {intakeRecommenders.filter((r) => r.kind === "dependent").length} dependent) — start typing to pick one or add a new name.
                  </p>
                ) : (
                  <p className="mt-0.5 text-[11px] text-text-muted">
                    No recommenders from intake yet — <a href={`/cases/${initialCase.id}/intake`} className="font-medium text-info-fill hover:underline">add them in Guided intake →</a>, or just type a name.
                  </p>
                )}
                <RecommenderCombobox
                  value={newRec.name}
                  options={intakeRecommenders}
                  usedNames={usedRecommenderNames}
                  preferKind={newLetterFor.defaultKind}
                  placeholder={intakeRecommenders.length > 0 ? "Type or pick a recommender…" : "Recommender's full name"}
                  onType={(name) => setNewRec((prev) => ({ ...prev, name }))}
                  onPick={(r) => selectIntakeRec(r)}
                />
              </div>
              {(
                [
                  { id: "title", label: "Title", type: "text" },
                  { id: "institution", label: "Institution", type: "text" },
                  {
                    id: "credentials",
                    label: "Key credentials",
                    type: "textarea",
                  },
                  {
                    id: "relationship",
                    label: "Relationship to applicant",
                    type: "textarea",
                  },
                ] as { id: keyof typeof newRec; label: string; type: string }[]
              ).map((f) => (
                <div key={f.id}>
                  <label className="block text-sm font-medium text-text-secondary">
                    {f.label}
                  </label>
                  {f.type === "textarea" ? (
                    <textarea
                      className="input mt-1"
                      rows={2}
                      value={String(newRec[f.id])}
                      onChange={(e) =>
                        setNewRec((prev) => ({
                          ...prev,
                          [f.id]: e.target.value,
                        }))
                      }
                    />
                  ) : (
                    <input
                      type="text"
                      className="input mt-1"
                      value={String(newRec[f.id])}
                      onChange={(e) =>
                        setNewRec((prev) => ({
                          ...prev,
                          [f.id]: e.target.value,
                        }))
                      }
                    />
                  )}
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Kind
                </label>
                <select
                  className="input mt-1"
                  value={newRec.kind}
                  onChange={(e) =>
                    setNewRec((prev) => ({
                      ...prev,
                      kind: e.target.value as "independent" | "dependent" | "governmental",
                    }))
                  }
                >
                  <option value="independent">Independent</option>
                  <option value="dependent">Dependent</option>
                  <option value="governmental">Governmental / quasi-governmental (DOE lab, NIH, NIST, etc.)</option>
                </select>
              </div>
            </div>
            <ModalFooter>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setNewLetterFor(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => createLetter()}
                disabled={creatingLetter || !newRec.name}
              >
                {creatingLetter ? "Creating..." : "Create letter"}
              </button>
            </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
