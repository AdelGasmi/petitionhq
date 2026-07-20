"use client";

// Token-based intake wizard — no auth required.
// Saves via /api/intake/[token] which restricts writes to petitionerInfo, qualifications, and endeavor.
// Documents uploaded via /api/intake/[token]/upload authenticated by the same token.

import { useState, useCallback, useRef } from "react";
import {
  StepPersonalInfo,
  StepBasis,
  StepEndeavor,
  StepPublications,
  StepRecognition,
  StepRecommenders,
  buildQualificationsPayload,
  buildEndeavorPayload,
  buildRecommendersPayload,
  type FullIntakeData,
} from "@/components/IntakeWizardShared";

type DocUploadState = {
  status: "pending" | "uploading" | "uploaded" | "error";
  filename?: string;
  error?: string;
};

type Props = {
  token: string;
  caseTitle: string;
  initialData: FullIntakeData;
};

const STEPS = [
  { title: "Your information", subtitle: "This fills Parts 1 & 3 of the I-140. Your attorney needs this to prepare the pre-filled form." },
  { title: "Your EB-2 basis", subtitle: "Establishes your qualification for an employment-based green card under EB-2." },
  { title: "Proposed endeavor", subtitle: "What you will do in the US and why it matters at a national level." },
  { title: "Research output", subtitle: "Publications are the core evidence for Prong 1 — substantial merit of your work." },
  { title: "Recognition & standing", subtitle: "Awards, grants, peer review, and talks build Prong 2 — you are well positioned." },
  { title: "Recommenders", subtitle: "People who can write recommendation letters. Your attorney handles drafting and sending." },
  { title: "Supporting documents", subtitle: "Upload any documents you have ready. Your attorney will guide you on anything missing." },
];

// Key documents to collect from the applicant at intake
const INTAKE_DOCS: { id: string; label: string; hint: string; required: boolean }[] = [
  { id: "passport", label: "Passport (biographic page)", hint: "Photo page showing your name, number, and expiry.", required: true },
  { id: "cv", label: "CV / Resume", hint: "Full academic or professional CV listing your publications, awards, and experience.", required: true },
  { id: "diplomas", label: "Diplomas & transcripts", hint: "All degrees. Non-English documents need certified translations.", required: true },
  { id: "citation-reports", label: "Citation report", hint: "Google Scholar profile screenshot or Scopus/Web of Science export.", required: false },
  { id: "i94", label: "I-94 (Arrival/Departure Record)", hint: "Download from cbp.gov/i94. Required if you've entered the US.", required: false },
];

function buildPayload(data: FullIntakeData, completed = false) {
  return {
    formData: {
      petitionerInfo: {
        familyName: data.familyName || undefined,
        givenName: data.givenName || undefined,
        middleName: data.middleName || undefined,
        dob: data.dob || undefined,
        cityOfBirth: data.cityOfBirth || undefined,
        countryOfBirth: data.countryOfBirth || undefined,
        countryOfCitizenship: data.countryOfCitizenship || undefined,
        currentStatus: data.currentStatus || undefined,
        currentAddress: {
          street: data.addressStreet || undefined,
          city: data.addressCity || undefined,
          state: data.addressState || undefined,
          zip: data.addressZip || undefined,
        },
        phone: data.phone || undefined,
        email: data.email || undefined,
        passportNumber: data.passportNumber || undefined,
        passportCountry: data.passportCountry || undefined,
        passportExpiry: data.passportExpiry || undefined,
      },
      qualifications: buildQualificationsPayload(data),
      endeavor: buildEndeavorPayload(data),
      recommenders: buildRecommendersPayload(data),
    },
    ...(completed ? { completed: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Document upload step
// ---------------------------------------------------------------------------

function StepDocuments({ token, docs, onStatusChange }: {
  token: string;
  docs: typeof INTAKE_DOCS;
  onStatusChange: (id: string, state: DocUploadState) => void;
}) {
  const [states, setStates] = useState<Record<string, DocUploadState>>(
    Object.fromEntries(docs.map((d) => [d.id, { status: "pending" }]))
  );
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const upload = async (docId: string, file: File) => {
    const next = (s: DocUploadState) => {
      setStates((prev) => ({ ...prev, [docId]: s }));
      onStatusChange(docId, s);
    };

    next({ status: "uploading" });

    const form = new FormData();
    form.append("file", file);
    form.append("docId", docId);

    try {
      const res = await fetch(`/api/intake/${token}/upload`, { method: "POST", body: form });
      const body = await res.json().catch(() => ({})) as { ok?: boolean; filename?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Upload failed (${res.status})`);
      next({ status: "uploaded", filename: body.filename });
    } catch (e) {
      next({ status: "error", error: e instanceof Error ? e.message : "Upload failed" });
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        Upload whatever you have ready — your attorney will follow up on anything still needed.
      </p>
      {docs.map((doc) => {
        const state = states[doc.id];
        return (
          <div key={doc.id} className="rounded-xl border border-border-default bg-surface-subtle px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-text-primary">{doc.label}</p>
                  {doc.required && (
                    <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">Required</span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-text-muted">{doc.hint}</p>
                {state.status === "uploaded" && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-success-text font-medium">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clipRule="evenodd" /></svg>
                    {state.filename}
                  </p>
                )}
                {state.status === "error" && (
                  <p className="mt-1 text-xs text-danger-fill">{state.error}</p>
                )}
              </div>
              <div className="shrink-0">
                {state.status === "uploaded" ? (
                  <button
                    type="button"
                    className="text-xs text-text-muted hover:text-text-secondary underline"
                    onClick={() => inputRefs.current[doc.id]?.click()}
                  >
                    Replace
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={state.status === "uploading"}
                    className="rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle disabled:opacity-50 transition-colors"
                    onClick={() => inputRefs.current[doc.id]?.click()}
                  >
                    {state.status === "uploading" ? "Uploading…" : "Upload"}
                  </button>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  ref={(el) => { inputRefs.current[doc.id] = el; }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(doc.id, f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
      <p className="text-xs text-text-muted">
        Accepted: PDF, Word, JPEG, PNG · Max 25 MB per file
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export function TokenIntakeWizard({ token, caseTitle, initialData }: Props) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FullIntakeData>(initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const set = useCallback((k: keyof FullIntakeData, v: unknown) => {
    setData((prev) => ({ ...prev, [k]: v }));
  }, []);

  const save = useCallback(async (d: FullIntakeData, completed = false) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/intake/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(d, completed)),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed — please try again.");
    } finally {
      setSaving(false);
    }
  }, [token]);

  const isLast = step === STEPS.length - 1;

  const next = async () => {
    // On the last (doc upload) step, mark completed and move to done
    if (isLast) {
      await save(data, true);
      if (!error) setDone(true);
      return;
    }
    await save(data);
    if (error) return;
    setStep((s) => s + 1);
  };

  if (done) {
    return (
      <div className="mx-auto max-w-md py-20 text-center space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success-bg">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10 text-success-text"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clipRule="evenodd" /></svg>
        </div>
        <div>
          <h1 className="font-serif text-2xl tracking-tight text-success-text">Information submitted</h1>
          <p className="mt-2 text-sm text-text-muted">
            Your attorney now has your full evidence profile. They will review it and reach out with next steps.
            You don&apos;t need to do anything else right now.
          </p>
        </div>
        <p className="text-xs text-text-muted">You can close this page.</p>
      </div>
    );
  }

  const current = STEPS[step];

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8">
        <div className="text-center mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Petition intake</p>
          <h1 className="mt-1 font-serif text-2xl tracking-tight">{caseTitle}</h1>
          <p className="mt-1 text-sm text-text-muted">Fill in your information to help your attorney build the strongest possible petition.</p>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
            <span>Step {step + 1} of {STEPS.length}</span>
            <span>{Math.round((step / STEPS.length) * 100)}% complete</span>
          </div>
          <div className="h-1 w-full rounded-full bg-surface-muted">
            <div className="h-1 rounded-full bg-brand-primary transition-all" style={{ width: `${(step / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-default bg-surface-card px-8 py-8 shadow-sm space-y-6">
        <div>
          <h2 className="font-serif text-xl">{current.title}</h2>
          <p className="mt-1 text-sm text-text-muted">{current.subtitle}</p>
        </div>

        {step === 0 && <StepPersonalInfo data={data} set={set} />}
        {step === 1 && <StepBasis data={data} set={set} />}
        {step === 2 && <StepEndeavor data={data} set={set} />}
        {step === 3 && <StepPublications data={data} set={set} />}
        {step === 4 && <StepRecognition data={data} set={set} />}
        {step === 5 && <StepRecommenders data={data} set={set} />}
        {step === 6 && (
          <StepDocuments
            token={token}
            docs={INTAKE_DOCS}
            onStatusChange={() => {}}
          />
        )}

        {error && <p className="text-sm text-danger-fill">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <button type="button" className="btn btn-secondary text-sm" onClick={() => setStep((s) => s - 1)} disabled={saving}>Back</button>
          ) : <div />}
          <button type="button" className="btn btn-primary text-sm px-6" onClick={next} disabled={saving}>
            {saving
              ? <span className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-surface-card" />Saving…</span>
              : isLast ? "Submit →" : "Save & continue"}
          </button>
        </div>
      </div>

      {/* Labeled, clickable step rail — every step (incl. Recommenders) is visible and jumpable */}
      <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Intake steps">
        {STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { if (i !== step) { save(data); setStep(i); } }}
            aria-current={i === step ? "step" : undefined}
            title={s.subtitle}
            className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
              i === step ? "bg-brand-primary text-surface-card font-medium"
              : i < step ? "text-text-secondary hover:bg-surface-muted"
              : "text-text-muted hover:bg-surface-subtle"
            }`}
          >
            <span className="tabular-nums opacity-60">{i + 1}.</span> {s.title}
          </button>
        ))}
      </nav>
      <p className="mt-4 text-center text-xs text-text-muted">Your information is saved automatically as you move between steps.</p>
    </div>
  );
}
