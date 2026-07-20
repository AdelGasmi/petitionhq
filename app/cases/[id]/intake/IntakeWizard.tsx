"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  StepPersonalInfo,
  StepBasis,
  StepEndeavor,
  StepPublications,
  StepRecognition,
  StepRecommenders,
  validateStep,
  buildQualificationsPayload,
  buildEndeavorPayload,
  buildRecommendersPayload,
  type FullIntakeData,
} from "@/components/IntakeWizardShared";

type Props = {
  caseId: string;
  caseTitle: string;
  initialData: FullIntakeData;
};

const STEPS = [
  { title: "Personal information", subtitle: "Fills Parts 1 & 3 of the I-140 form. Required for the pre-filled PDF." },
  { title: "Your EB-2 basis", subtitle: "Establishes that you qualify for an employment-based green card under EB-2." },
  { title: "Proposed endeavor", subtitle: "Describes what you will do in the US and why it matters at a national level." },
  { title: "Research output", subtitle: "Publications are the core evidence for Prong 1 — substantial merit." },
  { title: "Recognition & standing", subtitle: "Awards, grants, peer review, and talks build Prong 2 — you are well positioned." },
  { title: "Recommenders", subtitle: "People who can write recommendation letters for your petition. Your attorney handles drafting." },
];

function buildPayload(data: FullIntakeData) {
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
  };
}

export function IntakeWizard({ caseId, caseTitle, initialData }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<FullIntakeData>(initialData);
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveError, setSaveError] = useState("");

  const set = useCallback((k: keyof FullIntakeData, v: unknown) => {
    setData((prev) => ({ ...prev, [k]: v }));
    setValidationErrors([]);
  }, []);

  const save = useCallback(async (d: FullIntakeData) => {
    setSaving(true);
    setSaveError("");
    try {
      await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(d)),
      });
    } catch {
      setSaveError("Auto-save failed — check your connection.");
    } finally {
      setSaving(false);
    }
  }, [caseId]);

  const next = async () => {
    const errs = validateStep(step, data);
    if (errs.length > 0) { setValidationErrors(errs); return; }
    await save(data);
    if (step < STEPS.length - 1) { setStep((s) => s + 1); setValidationErrors([]); }
    else router.push(`/cases/${caseId}`);
  };

  const saveAndExit = async () => {
    const errs = validateStep(step, data);
    if (errs.length > 0) { setValidationErrors(errs); return; }
    await save(data);
    router.push(`/cases/${caseId}`);
  };

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  return (
    <div className="mx-auto max-w-2xl py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-text-muted">{caseTitle}</p>
            <h1 className="mt-0.5 font-serif text-2xl tracking-tight">Case intake</h1>
          </div>
          <button type="button" className="text-sm text-text-muted hover:text-text-secondary transition-colors" onClick={() => router.push(`/cases/${caseId}`)}>
            Exit without saving →
          </button>
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

        {validationErrors.length > 0 && (
          <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-3 space-y-1">
            {validationErrors.map((e, i) => <p key={i} className="text-sm text-danger-text">{e}</p>)}
          </div>
        )}
        {saveError && <p className="text-sm text-danger-fill">{saveError}</p>}

        <div className="flex items-center justify-between pt-2">
          {step > 0 ? (
            <button type="button" className="btn btn-secondary text-sm" onClick={() => { setStep((s) => s - 1); setValidationErrors([]); }} disabled={saving}>Back</button>
          ) : <div />}
          <div className="flex items-center gap-3">
            <button type="button" className="text-sm text-text-muted hover:text-text-secondary transition-colors" onClick={saveAndExit} disabled={saving}>Save & exit</button>
            <button type="button" className="btn btn-primary text-sm px-6" onClick={next} disabled={saving}>
              {saving ? <span className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-surface-card" />Saving…</span>
                : isLast ? "Done — go to workspace →" : "Save & continue"}
            </button>
          </div>
        </div>
      </div>

      {/* Labeled, clickable step rail — every step (incl. Recommenders) is visible and jumpable */}
      <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Intake steps">
        {STEPS.map((s, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { if (i !== step) { save(data); setStep(i); setValidationErrors([]); } }}
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
      <p className="mt-4 text-center text-xs text-text-muted">
        Data is saved automatically as you move between steps.{saving && " Saving…"}
      </p>
    </div>
  );
}
