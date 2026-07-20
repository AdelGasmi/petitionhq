"use client";

import { useState, useRef, useEffect, useCallback, type ComponentType } from "react";
import type { CheckAnswers, CheckResult } from "@/app/api/check/route";
import { resolveTier, TIER_THRESHOLDS, type Tier } from "@/lib/scoring";
import { TierHero, eb2PathLabel } from "@/components/TierHero";
import { InstitutionAutocomplete } from "@/components/check/InstitutionAutocomplete";
import { isPlausibleResearchField } from "@/lib/checkValidation";
import { AssessmentLoader } from "@/components/check/AssessmentLoader";
import { OrcidInlineCta } from "@/components/check/OrcidSignInButton";
import { Check, CheckCircle, ArrowRight, ArrowUpRight, Lock, Refresh, ChevronDown } from "@/components/icons";

// ---------------------------------------------------------------------------
// Step definitions — split light (before email gate) vs deep (after opt-in)
// ---------------------------------------------------------------------------

type FieldDef = {
  id: keyof CheckAnswers;
  label: string;
  hint?: string;
  type: "select" | "text" | "institution";
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

type StepDef = { title: string; subtitle: string; fields: FieldDef[] };

const LIGHT_STEPS: StepDef[] = [
  {
    title: "Your background",
    subtitle: "Two questions to establish whether EB-2 applies to your situation.",
    fields: [
      {
        id: "degree",
        label: "Highest degree",
        type: "select",
        options: ["PhD", "Master's (thesis-based)", "Master's (professional)", "MD / JD / Other professional degree", "Bachelor's", "No qualifying degree"],
      },
      {
        id: "field",
        label: "Field of expertise",
        type: "text",
        placeholder: "e.g. Machine Learning, Oncology, Climate Science",
      },
      {
        id: "institution",
        label: "Current or most recent institution",
        hint: "University, research lab, or employer — wherever you do your work",
        type: "institution",
        placeholder: "Start typing a university, lab, or company",
      },
      {
        id: "yearsExperience",
        label: "Years working in this field",
        type: "select",
        options: ["Less than 2 years", "2–5 years", "5–10 years", "More than 10 years"],
      },
    ],
  },
  {
    title: "Research output",
    subtitle: "Publications and citations are the foundation of a strong NIW argument.",
    fields: [
      {
        id: "publications",
        label: "Peer-reviewed publications",
        hint: "Journal articles, conference papers, book chapters",
        type: "select",
        options: ["None", "1–3", "4–10", "11–25", "More than 25"],
      },
      {
        id: "citations",
        label: "Total citations across all your work",
        hint: "Check Google Scholar or Semantic Scholar",
        type: "select",
        options: ["None or unknown", "1–50", "51–200", "201–500", "More than 500"],
      },
    ],
  },
];

const DEEP_STEPS: StepDef[] = [
  {
    title: "Recognition & standing",
    subtitle: "Prong 2 requires showing you are well-positioned to advance your field.",
    fields: [
      {
        id: "role",
        label: "Current role",
        type: "select",
        options: ["PhD student", "Postdoctoral researcher", "Research scientist / staff scientist", "Professor / faculty", "Industry researcher / engineer", "Founder / entrepreneur", "Other"],
      },
      {
        id: "awards",
        label: "Awards or prizes in your field",
        type: "select",
        options: ["None", "Institutional award (department, university)", "National award or prize", "International award or prize"],
      },
      {
        id: "grants",
        label: "Research grants received",
        type: "select",
        options: ["None", "Small grant (under $50K)", "Significant grant ($50K–$500K)", "Large grant (over $500K)"],
      },
      {
        id: "peerReview",
        label: "Peer review or editorial work",
        hint: "Reviewing papers, serving on editorial boards, program committees",
        type: "select",
        options: ["None", "Occasional reviewer (1–5 papers/year)", "Regular reviewer or program committee member", "Editorial board member or associate editor"],
      },
      {
        id: "invitedTalks",
        label: "Invited talks or keynotes",
        type: "select",
        options: ["None", "1–3", "4 or more"],
      },
      {
        id: "patents",
        label: "Patents",
        type: "select",
        options: ["None", "1–2 (granted or pending)", "3 or more"],
      },
    ],
  },
  {
    title: "National importance & US plan",
    subtitle: "Prong 1 and 3 depend on connecting your work to US priorities and explaining why a job offer waiver makes sense.",
    fields: [
      {
        id: "nationalConnection",
        label: "Can you connect your work to a US national priority?",
        hint: "e.g. a federal agency initiative, NIST framework, NIH priority, DOE clean energy goal",
        type: "select",
        options: [
          "No clear connection",
          "General benefit to the US (no specific program)",
          "I can name a specific federal program or agency priority",
          "My work directly addresses a named national initiative with documented urgency",
        ],
      },
      {
        id: "usPlan",
        label: "How concrete is your US plan?",
        type: "select",
        options: [
          "No specific plan yet",
          "General field or type of work",
          "Named institution, lab, or collaborator in mind",
          "Funded position, signed agreement, or active collaboration",
        ],
      },
      {
        id: "employerSituation",
        label: "Employer sponsorship situation",
        hint: "A key argument for the waiver is that employer sponsorship is impractical for your type of work",
        type: "select",
        options: [
          "I have an employer who could sponsor me through PERM",
          "No employer has offered sponsorship",
          "My research is self-directed — no single employer applies",
          "My field rarely uses employer-sponsored petitions for this type of work",
        ],
      },
    ],
  },
];

const EMPTY_LIGHT = { degree: "", field: "", institution: "", institutionRorId: "", yearsExperience: "", publications: "", citations: "" };
const EMPTY_DEEP = { role: "", patents: "", awards: "", grants: "", peerReview: "", invitedTalks: "", nationalConnection: "", usPlan: "", employerSituation: "" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Semantic tier class maps — replaces the old inline tierColor() helper
const TIER_CONTAINER: Record<Tier, string> = {
  strong:     "bg-success-bg border-success-border",
  developing: "bg-warning-bg border-warning-border",
  early:      "bg-surface-muted border-border-default",
};
const TIER_TEXT: Record<Tier, string> = {
  strong:     "text-success-text",
  developing: "text-warning-text",
  early:      "text-text-secondary",
};

async function runAssessment(answers: CheckAnswers, turnstileToken?: string): Promise<CheckResult> {
  const res = await fetch("/api/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...answers, turnstileToken }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as CheckResult;
}

// ---------------------------------------------------------------------------
// Trust signal bar
// ---------------------------------------------------------------------------

function TrustBar() {
  return (
    <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-text-muted">
      <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success-fill shrink-0" /> Free NIW strength assessment</span>
      <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success-fill shrink-0" /> No payment required</span>
      <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success-fill shrink-0" /> Attorney matching is optional</span>
      <span className="inline-flex items-center gap-1"><Check className="h-3.5 w-3.5 text-success-fill shrink-0" /> Your data is private and can be removed on request</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Light wizard
// ---------------------------------------------------------------------------

function LightWizard({
  answers,
  onChange,
  onComplete,
}: {
  answers: typeof EMPTY_LIGHT;
  onChange: (id: keyof typeof EMPTY_LIGHT, val: string) => void;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const current = LIGHT_STEPS[step];
  const isLast = step === LIGHT_STEPS.length - 1;
  const stepComplete = () => current.fields.every((f) => {
    if (f.required === false) return true;
    const v = (answers[f.id as keyof typeof EMPTY_LIGHT] ?? "").trim();
    if (v === "") return false;
    // G-3: the free-text field must be a real field of study, not "18" / "cpu".
    if (f.id === "field") return isPlausibleResearchField(v);
    return true;
  });
  const totalSteps = LIGHT_STEPS.length + DEEP_STEPS.length;

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-8 text-center space-y-3">
        <h1 className="font-serif text-3xl tracking-tight">EB-2 NIW Eligibility Check</h1>
        <p className="text-sm text-text-muted">
          6 questions. Get an honest preliminary score — no account needed.
        </p>
        <TrustBar />
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span>Step {step + 1} of {totalSteps}</span>
          <span>{Math.round(((step) / totalSteps) * 100)}% complete</span>
        </div>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${((step) / totalSteps) * 100}%` }} />
        </div>
      </div>

      <div className="card-lg space-y-6">
        <div>
          <h2 className="font-serif text-xl">{current.title}</h2>
          <p className="mt-1 text-sm text-text-muted">{current.subtitle}</p>
        </div>
        <div className="space-y-5">
          {current.fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">{field.label}</label>
              {field.hint && <p className="text-xs text-text-muted">{field.hint}</p>}
              {field.type === "select" ? (
                <select
                  className="select text-sm"
                  value={answers[field.id as keyof typeof EMPTY_LIGHT] ?? ""}
                  onChange={(e) => onChange(field.id as keyof typeof EMPTY_LIGHT, e.target.value)}
                >
                  <option value="">Select…</option>
                  {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === "institution" ? (
                <InstitutionAutocomplete
                  value={answers.institution ?? ""}
                  rorId={answers.institutionRorId ?? ""}
                  placeholder={field.placeholder}
                  onChange={(name, rorId) => {
                    onChange("institution", name);
                    onChange("institutionRorId", rorId);
                  }}
                />
              ) : (
                <input
                  type="text"
                  className="input text-sm"
                  placeholder={field.placeholder}
                  value={answers[field.id as keyof typeof EMPTY_LIGHT] ?? ""}
                  onChange={(e) => onChange(field.id as keyof typeof EMPTY_LIGHT, e.target.value)}
                />
              )}
              {field.id === "field"
                && (answers.field ?? "").trim() !== ""
                && !isPlausibleResearchField(answers.field) && (
                <p className="text-xs text-danger-text">Enter a real field of study — e.g. Machine Learning, Oncology, Economics.</p>
              )}
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button type="button" className="btn btn-secondary text-sm" onClick={() => setStep((s) => s - 1)}>Back</button>
            ) : <div />}
            <button
              type="button"
              className="btn btn-primary text-sm px-6"
              onClick={() => { if (!stepComplete()) return; isLast ? onComplete() : setStep((s) => s + 1); }}
              disabled={!stepComplete()}
            >
              {isLast ? "Get my preliminary score →" : "Next"}
            </button>
          </div>
          {!stepComplete() && (
            <p className="text-xs text-text-muted text-right">Fill in all fields above to continue</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {[...LIGHT_STEPS, ...DEEP_STEPS].map((_, i) => (
          <div key={i} className={`step-dot ${i === step ? "step-dot-active" : i < step ? "step-dot-complete" : "step-dot-pending"}`} />
        ))}
      </div>
      <p className="mt-6 text-center text-xs text-text-muted">
        Your data is private and never shared without your consent.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email gate
// ---------------------------------------------------------------------------

type EmailGateResult = {
  error?: string;
  existing?: boolean;
  existingName?: string;
};

function EmailGate({
  assessmentRef,
  onComplete,
  onReassess,
}: {
  assessmentRef: React.MutableRefObject<Promise<CheckResult | null>>;
  onComplete: (result: CheckResult, email: string, firstName: string, lastName: string, orcid?: string) => Promise<EmailGateResult>;
  onReassess: (result: CheckResult, email: string, existingName: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [orcid, setOrcid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [existingPrompt, setExistingPrompt] = useState<{
    result: CheckResult;
    existingName: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!firstName.trim()) {
      setError("Please enter your first name so we can match your public research record.");
      return;
    }
    if (!lastName.trim()) {
      setError("Please enter your last name so we can match your public research record.");
      return;
    }
    setLoading(true);
    setError("");
    setExistingPrompt(null);
    try {
      const result = await (assessmentRef.current ?? Promise.resolve(null));
      if (!result) { setError("Assessment failed — please try again."); return; }
      const resp = await onComplete(result, email.trim(), firstName.trim(), lastName.trim(), orcid.trim() || undefined);
      if (resp.error) { setError(resp.error); return; }
      if (resp.existing) {
        setExistingPrompt({ result, existingName: resp.existingName ?? "" });
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AssessmentLoader
        title="Calculating your NIW score"
        captions={[
          "Reviewing your credentials",
          "Mapping evidence to the Dhanasar prongs",
          "Scoring your petition strength",
        ]}
      />
    );
  }

  if (existingPrompt) {
    return (
      <div className="mx-auto max-w-md py-20 space-y-8">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-warning-bg border border-warning-border">
            <Refresh className="h-7 w-7 text-warning-text" />
          </div>
          <h2 className="font-serif text-2xl tracking-tight">We&apos;ve seen this email before</h2>
          <p className="text-sm text-text-muted">
            {existingPrompt.existingName
              ? <><strong>{existingPrompt.existingName}</strong>, you&apos;ve already completed an assessment.</>
              : <>This email has already been used for an assessment.</>
            }
          </p>
        </div>

        <div className="card-lg space-y-4">
          <p className="text-sm text-text-secondary">
            Would you like to re-assess with the updated answers you just provided? Your previous results will be replaced.
          </p>
          <button
            type="button"
            className="btn btn-primary w-full text-sm"
            onClick={() => onReassess(
              existingPrompt.result,
              email.trim(),
              existingPrompt.existingName,
            )}
          >
            Re-assess with my new answers →
          </button>
          <button
            type="button"
            className="btn btn-ghost w-full text-sm"
            onClick={() => {
              setExistingPrompt(null);
              setEmail("");
              setFirstName("");
              setLastName("");
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md py-20 space-y-8">
      <div className="text-center space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted">
          <Lock className="h-7 w-7 text-text-muted" />
        </div>
        <h2 className="font-serif text-2xl tracking-tight">Your NIW score is ready</h2>
        <p className="text-sm text-text-muted">Tell us who you are and where to send it.</p>
      </div>

      <div className="card-lg space-y-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="lead-first-name" className="field-label">
                  First name <span className="field-required">*</span>
                </label>
                <input
                  id="lead-first-name"
                  type="text"
                  required
                  autoComplete="given-name"
                  className="input"
                  placeholder="Maria"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="lead-last-name" className="field-label">
                  Last name <span className="field-required">*</span>
                </label>
                <input
                  id="lead-last-name"
                  type="text"
                  required
                  autoComplete="family-name"
                  className="input"
                  placeholder="Rodriguez"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            <p className="text-xs text-text-muted">
              We use your name to match your public research record (OpenAlex, ORCID) — it&apos;s never shared without your consent.
            </p>
            <div className="space-y-1.5">
              <label htmlFor="lead-email" className="field-label">
                Email address <span className="field-required">*</span>
              </label>
              <input
                id="lead-email"
                type="email"
                required
                autoComplete="email"
                className="input"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="lead-orcid" className="field-label">
                ORCID iD <span className="font-normal text-text-muted">(optional)</span>
              </label>
              <input
                id="lead-orcid"
                type="text"
                className="input"
                placeholder="0000-0002-1825-0097"
                value={orcid}
                onChange={(e) => setOrcid(e.target.value)}
                disabled={loading}
              />
              <p className="text-xs text-text-muted">
                Providing your ORCID lets us fetch your exact record by ID instead of searching by name — the most reliable identity match we can make.
              </p>
            </div>
          </div>
          {error && <p className="text-sm text-danger-text">{error}</p>}
          <button type="submit" disabled={loading || !email.trim() || !firstName.trim() || !lastName.trim()} className="btn btn-primary w-full text-sm">
            {loading ? "Fetching your results…" : "See my NIW score →"}
          </button>
        </form>
        <TrustBar />
        <p className="text-center text-xs text-text-muted">
          No spam. Attorney matching is optional — you decide after seeing your score.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preliminary result + opt-in
// ---------------------------------------------------------------------------

function snapshotSignal(result: CheckResult): { icon: ComponentType<{ className?: string }>; label: string; textClass: string; bgClass: string; borderClass: string } {
  if (result.tier === "Strong" || result.score >= 65)
    return { icon: CheckCircle, label: "Strong Foundation", textClass: "text-success-text", bgClass: "bg-success-bg", borderClass: "border-success-border" };
  if (result.tier === "Developing" || result.score >= 40)
    return { icon: ArrowRight, label: "Promising Profile", textClass: "text-warning-text", bgClass: "bg-warning-bg", borderClass: "border-warning-border" };
  return { icon: ArrowUpRight, label: "Early Stage", textClass: "text-text-secondary", bgClass: "bg-surface-muted", borderClass: "border-border-default" };
}

function snapshotBullets(result: CheckResult): string[] {
  const bullets: string[] = [];
  const eb2 = result.dimensions.find((d) => d.label.includes("Baseline"));
  const merit = result.dimensions.find((d) => d.label.includes("Merit"));
  if (eb2 && eb2.score >= 70) bullets.push("Your degree qualifies for EB-2 classification");
  if (merit && merit.score >= 60) bullets.push("Your publication record supports substantial merit");
  if (result.score >= 65) bullets.push("Strong starting position for an NIW petition");
  else if (result.score >= 40) bullets.push("Solid credentials — full profile will sharpen the picture");
  if (bullets.length === 0) bullets.push("Every profile has a path forward with the right strategy");
  return bullets.slice(0, 3);
}

function PreliminaryResult({
  result,
  onOptIn,
  onDecline,
}: {
  result: CheckResult;
  onOptIn: () => void;
  onDecline: () => void;
}) {
  const signal = snapshotSignal(result);
  const SignalIcon = signal.icon;
  const bullets = snapshotBullets(result);

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <div className="text-center space-y-1">
        <h1 className="font-serif text-3xl tracking-tight">Your NIW Quick Snapshot</h1>
        <p className="text-sm text-text-muted">Based on your research background — 6 of 15 questions answered</p>
      </div>

      {/* Qualitative signal card — no numeric score */}
      <div className={`rounded-2xl border px-8 py-8 ${signal.bgClass} ${signal.borderClass}`}>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
          <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-surface-card/80 shadow-sm ${signal.textClass}`}>
            <SignalIcon className="h-9 w-9" />
          </div>
          <div className="flex-1">
            <div className="text-center sm:text-left">
              <span className={`inline-block rounded-full px-4 py-1.5 text-sm font-bold ${signal.bgClass} ${signal.textClass} border ${signal.borderClass}`}>
                {signal.label}
              </span>
            </div>
            {/* Long-form text stays left-aligned on every viewport — centered
                multi-line paragraphs are unreadable on mobile. */}
            <p className={`mt-3 text-sm leading-relaxed text-left ${signal.textClass}`}>{result.summary}</p>
            <ul className="mt-4 space-y-1.5 text-left">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                  <Check className="mt-0.5 h-4 w-4 text-success-text shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Locked dimensions teaser */}
      <div className="card space-y-3">
        <h3 className="font-serif text-lg">Unlock your full Dhanasar analysis</h3>
        <div className="space-y-2.5">
          {["Awards, grants & peer review standing", "National importance alignment", "Waiver justification strength"].map((label, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-canvas px-4 py-2.5">
              <Lock className="h-4 w-4 shrink-0 text-text-muted" />
              <span className="text-sm text-text-muted">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA — framed as unlocking, not fixing */}
      <div className="card-feature space-y-4">
        <div className="text-center space-y-2">
          <h3 className="font-serif text-lg text-text-inverted">
            {result.score >= TIER_THRESHOLDS.developing
              ? "Your research output looks strong. Let's see the full picture."
              : "Complete your profile to unlock your full NIW assessment."}
          </h3>
          <p className="text-sm text-text-muted">
            9 more questions about your recognition, US plans, and employer situation.
            {result.score >= TIER_THRESHOLDS.developing && " We'll generate your Dhanasar three-prong breakdown and — with your consent — match you with a vetted NIW attorney."}
          </p>
        </div>
        <button type="button" className="btn btn-inverted btn-lg w-full" onClick={onOptIn}>
          Unlock my full assessment →
        </button>
        <p className="text-center text-xs text-text-muted">
          No commitment. Attorney matching is entirely opt-in.
        </p>
      </div>

      <button type="button" className="block mx-auto text-xs text-text-muted hover:text-text-muted" onClick={onDecline}>
        No thanks, this is enough for now
      </button>

      <p className="text-center text-xs text-text-muted">
        This assessment is for informational purposes only and does not constitute legal advice.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Deep wizard (steps 3-4)
// ---------------------------------------------------------------------------

function DeepWizard({
  answers,
  onChange,
  onComplete,
  lightStepCount,
}: {
  answers: typeof EMPTY_DEEP;
  onChange: (id: keyof typeof EMPTY_DEEP, val: string) => void;
  onComplete: () => void;
  lightStepCount: number;
}) {
  const [step, setStep] = useState(0);
  const current = DEEP_STEPS[step];
  const isLast = step === DEEP_STEPS.length - 1;
  const stepComplete = () => current.fields.every((f) => f.required === false || (answers[f.id as keyof typeof EMPTY_DEEP] ?? "").trim() !== "");
  const totalSteps = LIGHT_STEPS.length + DEEP_STEPS.length;
  const displayStep = lightStepCount + step;

  return (
    <div className="mx-auto max-w-xl py-8">
      <div className="mb-8 text-center space-y-2">
        <h1 className="font-serif text-2xl tracking-tight">Complete your assessment</h1>
        <p className="text-sm text-text-muted">
          {DEEP_STEPS.length - step} more {step === DEEP_STEPS.length - 1 ? "step" : "steps"} to a full NIW analysis.
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs text-text-muted">
          <span>Step {displayStep + 1} of {totalSteps}</span>
          <span>{Math.round(((displayStep) / totalSteps) * 100)}% complete</span>
        </div>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${((displayStep) / totalSteps) * 100}%` }} />
        </div>
      </div>

      <div className="card-lg space-y-6">
        <div>
          <h2 className="font-serif text-xl">{current.title}</h2>
          <p className="mt-1 text-sm text-text-muted">{current.subtitle}</p>
        </div>
        <div className="space-y-5">
          {current.fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="block text-sm font-medium text-text-primary">{field.label}</label>
              {field.hint && <p className="text-xs text-text-muted">{field.hint}</p>}
              <select
                className="select text-sm"
                value={answers[field.id as keyof typeof EMPTY_DEEP] ?? ""}
                onChange={(e) => onChange(field.id as keyof typeof EMPTY_DEEP, e.target.value)}
              >
                <option value="">Select…</option>
                {field.options!.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            {step > 0 ? (
              <button type="button" className="btn btn-secondary text-sm" onClick={() => setStep((s) => s - 1)}>Back</button>
            ) : <div />}
            <button
              type="button"
              className="btn btn-primary text-sm px-6"
              onClick={() => { if (!stepComplete()) return; isLast ? onComplete() : setStep((s) => s + 1); }}
              disabled={!stepComplete()}
            >
              {isLast ? "Get my full assessment →" : "Next"}
            </button>
          </div>
          {!stepComplete() && (
            <p className="text-xs text-text-muted text-right">Fill in all fields above to continue</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {[...LIGHT_STEPS, ...DEEP_STEPS].map((_, i) => (
          <div key={i} className={`step-dot ${i === displayStep ? "step-dot-active" : i < displayStep ? "step-dot-complete" : "step-dot-pending"}`} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full result
// ---------------------------------------------------------------------------

function GapNarrativeCard({ narrative, tier }: { narrative: CheckResult["gapNarrative"]; tier: CheckResult["tier"] }) {
  if (!narrative) return null;
  const isStrong = tier === "Strong";

  return (
    <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5 space-y-5">
      <h3 className="font-serif text-lg">Your case at a glance</h3>

      {/* Strengths */}
      {narrative.strengths?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-success-text">What&apos;s working</p>
          <ul className="space-y-1.5">
            {narrative.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success-text" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Blockers — orange arrows for non-strong, softer language */}
      {narrative.blockers?.length > 0 && (
        <div className="space-y-2">
          <p className={`text-xs font-semibold uppercase tracking-wide ${isStrong ? "text-warning-text" : "text-warning-text"}`}>
            {isStrong ? "What could be stronger" : "Areas requiring legal strategy"}
          </p>
          <ul className="space-y-1.5">
            {narrative.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-warning-text" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Legal leverage — active attorney framing */}
      {narrative.legalLeverage?.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-info-text">
            {isStrong ? "How an attorney helps" : "Strategic next steps"}
          </p>
          <ul className="space-y-1.5">
            {narrative.legalLeverage.map((l, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-info-text" />
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ConsentCheckbox({ leadId, resultToken, onConsentGiven }: { leadId: string; resultToken?: string; onConsentGiven?: () => void }) {
  const [consented, setConsented] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleConsent = async (checked: boolean) => {
    setConsented(checked);
    if (!checked) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultToken }),
      });
      if (res.ok) {
        setSaved(true);
        onConsentGiven?.();
      }
    } catch { /* best-effort */ }
    finally { setSaving(false); }
  };

  if (saved) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-success-bg border border-success-border px-4 py-3">
        <Check className="h-4 w-4 text-success-text" />
        <p className="text-sm text-success-text">
          You&apos;re opted in. We&apos;re onboarding NIW attorneys now — if a firm wants to take your case, we&apos;ll email you. Your assessment stays saved either way.
        </p>
      </div>
    );
  }

  return (
    <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-border-default px-4 py-3 hover:bg-surface-canvas transition-colors">
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 rounded border-border-default text-text-primary focus:ring-border-strong"
        checked={consented}
        onChange={(e) => handleConsent(e.target.checked)}
        disabled={saving}
      />
      <div>
        <p className="text-sm font-medium text-text-primary">
          Connect me with a vetted NIW attorney
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          We&apos;ll share your assessment with an attorney in our network who handles cases in your field.
          No commitment — you decide whether to proceed after speaking with them.
        </p>
      </div>
    </label>
  );
}

function LockedDhanasarTeaser() {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5 space-y-4">
      <h3 className="font-serif text-lg">Dhanasar Three-Prong Breakdown</h3>
      <div className="space-y-2.5">
        {["EB-2 Baseline", "Prong 1 — Substantial Merit & National Importance", "Prong 2 — Well Positioned to Advance", "Prong 3 — Waiver Justified"].map((label, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-canvas px-4 py-2.5">
            <Lock className="h-4 w-4 shrink-0 text-text-muted" />
            <span className="text-sm text-text-muted">{label}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-text-muted">Opt in to attorney matching above to unlock your full prong-by-prong analysis.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dhanasar breakdown — accordion for non-strong tiers
// ---------------------------------------------------------------------------

function DhanasarBreakdown({ dimensions, collapsed }: { dimensions: CheckResult["dimensions"]; collapsed?: boolean }) {
  const [open, setOpen] = useState(!collapsed);

  const content = (
    <div className="space-y-4">
      {dimensions.map((d, i) => (
        <div key={i}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text-secondary">{d.label}</span>
            <span className={`text-xs font-semibold tabular-nums ${d.score >= 70 ? "text-success-text" : d.score >= 45 ? "text-warning-text" : "text-text-muted"}`}>{d.score}/100</span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-surface-muted">
            <div className={`h-1.5 rounded-full transition-all ${d.score >= 70 ? "bg-success-fill" : d.score >= 45 ? "bg-warning-fill" : "bg-danger-fill"}`} style={{ width: `${d.score}%` }} />
          </div>
          {d.notes && <p className="mt-1 text-xs text-text-muted leading-snug">{d.notes}</p>}
        </div>
      ))}
    </div>
  );

  if (!collapsed) {
    return (
      <div className="rounded-xl border border-border-default bg-surface-card px-6 py-5 space-y-4">
        <h3 className="font-serif text-lg">Dhanasar Three-Prong Breakdown</h3>
        {content}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <h3 className="font-serif text-lg">Dhanasar Three-Prong Breakdown</h3>
        <ChevronDown className={`h-4 w-4 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-6 pb-5 space-y-4">{content}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Full result — different layouts for strong vs. developing cases
// ---------------------------------------------------------------------------

function FullResult({ result, onReset, leadId, resultToken }: { result: CheckResult; onReset: () => void; leadId?: string; resultToken?: string }) {
  const isStrong = result.tier === "Strong";
  const [consentGiven, setConsentGiven] = useState(false);

  // ─── STRONG CASE LAYOUT ─────────────────────────────────────────
  if (isStrong) {
    const tier = resolveTier(result.tier);
    return (
      <div className="mx-auto max-w-2xl py-8 space-y-8">
        <div className="text-center space-y-1">
          <h1 className="font-serif text-3xl tracking-tight">Your Full NIW Assessment</h1>
          <p className="text-sm text-text-secondary">Based on your complete profile</p>
        </div>

        <TierHero
          tier={tier}
          score={result.score}
          summary={result.summary}
          badgeLabel="Strong Case"
          pathLabel={eb2PathLabel(result.eb2Path) ?? "EB-2 path unclear"}
        />

        {result.gapNarrative && <GapNarrativeCard narrative={result.gapNarrative} tier={result.tier} />}

        {leadId && <ConsentCheckbox leadId={leadId} resultToken={resultToken} onConsentGiven={() => setConsentGiven(true)} />}

        {/* ORCID identity CTA — previously only on the standalone result page,
            so in-wizard completions never saw it. Compact: consent stays primary. */}
        {leadId && <OrcidInlineCta leadId={leadId} />}

        {consentGiven ? (
          <DhanasarBreakdown dimensions={result.dimensions} />
        ) : (
          <LockedDhanasarTeaser />
        )}

        {/* What happens next */}
        <div className="card space-y-4">
          <h3 className="font-serif text-lg">What happens next</h3>
          <ol className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">1</span>
              <span><strong className="text-text-primary">Attorney matching.</strong> We&apos;re onboarding vetted NIW firms now. If one wants to take your case, we&apos;ll email you — no fixed timeline, and no contact unless a firm opts in.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">2</span>
              <span><strong className="text-text-primary">Free strategy call.</strong> Discuss your case, your gaps, and whether NIW is the right path. No commitment.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">3</span>
              <span><strong className="text-text-primary">If you decide to proceed,</strong> you get access to a shared workspace where you and your attorney build your petition together.</span>
            </li>
          </ol>
        </div>

        <div className="flex justify-center">
          <button type="button" className="btn btn-ghost text-sm" onClick={onReset}>← Re-assess with different answers</button>
        </div>
        <p className="text-center text-xs text-text-muted">This assessment is for informational purposes only and does not constitute legal advice.</p>
      </div>
    );
  }

  // ─── DEVELOPING / EARLY CASE LAYOUT ─────────────────────────────
  const tier = resolveTier(result.tier);

  return (
    <div className="mx-auto max-w-2xl py-8 space-y-8">
      {/* 1. The Snapshot — positive framing, no numeric score */}
      <TierHero
        tier={tier}
        score={result.score}
        summary={result.summary}
        pathLabel={eb2PathLabel(result.eb2Path) ?? "EB-2 path to be determined"}
      />

      {/* 2. Gap narrative — strengths + areas needing strategy + attorney interventions */}
      {result.gapNarrative && <GapNarrativeCard narrative={result.gapNarrative} tier={result.tier} />}

      {/* 3. The Hero Intervention — attorney as active problem-solver */}
      <div className="rounded-xl border px-6 py-6 space-y-4 bg-info-bg border-info-border">
        <h3 className="font-serif text-lg text-info-text">How a legal strategy shifts your case</h3>
        <p className="text-sm text-info-text">
          {result.tier === "Developing"
            ? "Developing profiles are frequently approved when the legal framing is precise. Attorneys in our network specialize in cases like yours."
            : "Every NIW case starts somewhere. The right legal strategy turns raw credentials into a structured, approvable petition."
          }
        </p>
        <ul className="space-y-3">
          <li className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info-soft text-xs font-bold text-info-text">1</span>
            <span><strong className="text-text-primary">Federal strategy mapping:</strong> An attorney will map your work against specific federal mandates and agency priorities to build a compliant National Importance narrative.</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info-soft text-xs font-bold text-info-text">2</span>
            <span><strong className="text-text-primary">Alternative influence profiling:</strong> Beyond citation counts, an attorney will structure recommendation letters to emphasize industry adoption, technical breakthroughs, and peer-review governance.</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info-soft text-xs font-bold text-info-text">3</span>
            <span><strong className="text-text-primary">US integration positioning:</strong> An attorney will consult on how to formally structure your research plans or employment intent to satisfy the &ldquo;Well Positioned&rdquo; requirement.</span>
          </li>
        </ul>
      </div>

      {/* 4. Consent CTA */}
      {leadId && <ConsentCheckbox leadId={leadId} onConsentGiven={() => setConsentGiven(true)} />}

      {/* 4b. ORCID identity CTA — compact so consent stays the primary action */}
      {leadId && <OrcidInlineCta leadId={leadId} />}

      {/* 5. What happens next */}
      <div className="card space-y-4">
        <h3 className="font-serif text-lg">What happens next</h3>
        <ol className="space-y-3">
          <li className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">1</span>
            <span><strong className="text-text-primary">Attorney matching.</strong> We&apos;re onboarding vetted NIW firms now. If one wants to take your case, we&apos;ll email you — no fixed timeline, and no contact unless a firm opts in.</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">2</span>
            <span><strong className="text-text-primary">Free strategy call.</strong> Discuss your case, your gaps, and whether NIW is the right path. No commitment.</span>
          </li>
          <li className="flex items-start gap-3 text-sm text-text-secondary">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">3</span>
            <span><strong className="text-text-primary">If you decide to proceed,</strong> you get access to a shared workspace where you and your attorney build your petition together.</span>
          </li>
        </ol>
      </div>

      {/* Dhanasar breakdown — gated behind consent */}
      {consentGiven ? (
        <DhanasarBreakdown dimensions={result.dimensions} collapsed />
      ) : (
        <LockedDhanasarTeaser />
      )}

      <div className="flex justify-center">
        <button type="button" className="btn btn-ghost text-sm" onClick={onReset}>← Re-assess with different answers</button>
      </div>
      <p className="text-center text-xs text-text-muted">This assessment is for informational purposes only and does not constitute legal advice.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page — state machine
// ---------------------------------------------------------------------------

type Phase = "light" | "email" | "preliminary" | "deep" | "result" | "declined";

export default function CheckPage() {
  const [phase, setPhase] = useState<Phase>("light");
  const [lightAnswers, setLightAnswers] = useState<typeof EMPTY_LIGHT>({ ...EMPTY_LIGHT });
  const [deepAnswers, setDeepAnswers] = useState<typeof EMPTY_DEEP>({ ...EMPTY_DEEP });
  const [emailCapture, setEmailCapture] = useState({ email: "", firstName: "", lastName: "" });
  const [prelimResult, setPrelimResult] = useState<CheckResult | null>(null);
  const [fullResult, setFullResult] = useState<CheckResult | null>(null);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [resultToken, setResultToken] = useState<string | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  // Turnstile removed from /check — server is fail-open on "__turnstile_failed__"
  const turnstileTokenRef = useRef<string>("__turnstile_failed__");
  // Promise started in background during email gate
  const assessmentRef = useRef<Promise<CheckResult | null>>(Promise.resolve(null));

  // ── Funnel drop-off tracking ──────────────────────────────────────
  const phaseRef = useRef<Phase>(phase);
  phaseRef.current = phase;
  const sessionIdRef = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  );

  const sendBounce = useCallback(() => {
    const p = phaseRef.current;
    // Terminal phases — user completed or declined, not a bounce
    if (p === "result" || p === "declined") return;
    const payload = JSON.stringify({
      event: "check.bounced",
      sessionId: sessionIdRef.current,
      props: { phase: p },
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/funnel", payload);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("beforeunload", sendBounce);
    return () => window.removeEventListener("beforeunload", sendBounce);
  }, [sendBounce]);

  const [refCode, setRefCode] = useState<string | undefined>();
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setRefCode(ref);
  }, []);

  const saveLead = async (result: CheckResult, email: string, firstName: string, lastName: string, formData: Partial<CheckAnswers>, token?: string): Promise<EmailGateResult> => {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        tier: result.tier,
        score: result.score,
        summary: result.summary,
        dimensions: result.dimensions,
        gapNarrative: result.gapNarrative
          ? {
              strengths: result.gapNarrative.strengths?.join(" "),
              blockers: result.gapNarrative.blockers?.join(" "),
              legalLeverage: result.gapNarrative.legalLeverage?.join(" "),
            }
          : undefined,
        formData,
        source: "check",
        refCode,
        turnstileToken: token,
      }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error ?? "Something went wrong." };
    if (data.leadId) setLeadId(data.leadId);
    if (data.resultToken) setResultToken(data.resultToken);
    if (data.existing) return { existing: true, existingName: data.existingName ?? "" };
    return {};
  };

  const updateLead = async (result: CheckResult, formData: Partial<CheckAnswers>, overrideLeadId?: string) => {
    const lid = overrideLeadId ?? leadId;
    if (!lid || !resultToken) return;
    try {
      await fetch(`/api/leads/${lid}/reassess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultToken,
          tier: result.tier,
          score: result.score,
          formData: {
            ...formData,
            _gapNarrative: result.gapNarrative,
            _dimensions: result.dimensions,
            _summary: result.summary,
          },
        }),
      });
    } catch { /* update is best-effort */ }
  };

  // Called when light wizard finishes — kick off background assessment
  const onLightComplete = () => {
    const partial: CheckAnswers = { ...lightAnswers, ...EMPTY_DEEP };
    assessmentRef.current = runAssessment(partial, turnstileTokenRef.current).catch(() => null);
    setPhase("email");
  };

  const onEmailComplete = async (result: CheckResult, email: string, firstName: string, lastName: string, orcid?: string): Promise<EmailGateResult> => {
    const formData = { ...lightAnswers, ...(orcid ? { orcid } : {}) };
    const resp = await saveLead(result, email, firstName, lastName, formData, turnstileTokenRef.current);
    if (resp.error) return resp;
    if (resp.existing) return resp;
    setEmailCapture({ email, firstName, lastName });
    setPrelimResult(result);
    setPhase("preliminary");
    return {};
  };

  const onReassess = (result: CheckResult, email: string, existingName: string) => {
    // For existing leads we have the combined name — split on first space as best-effort.
    const spaceIdx = existingName.indexOf(" ");
    const firstN = spaceIdx > 0 ? existingName.slice(0, spaceIdx) : existingName;
    const lastN = spaceIdx > 0 ? existingName.slice(spaceIdx + 1) : "";
    setEmailCapture({ email, firstName: firstN, lastName: lastN });
    setPrelimResult(result);
    updateLead(result, lightAnswers);
    setPhase("preliminary");
  };

  // Opted in to deep intake
  const onOptIn = () => setPhase("deep");

  const onDecline = () => {
    if (leadId && resultToken && prelimResult) {
      fetch(`/api/leads/${leadId}/reassess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultToken,
          formData: {
            ...lightAnswers,
            _gapNarrative: prelimResult.gapNarrative,
            _dimensions: prelimResult.dimensions,
            _summary: prelimResult.summary,
          },
        }),
      }).catch(() => {});
    } else if (leadId && resultToken) {
      fetch(`/api/leads/${leadId}/reassess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultToken }),
      }).catch(() => {});
    }
    setPhase("declined");
  };

  // Deep wizard finished — run full assessment
  const onDeepComplete = async () => {
    setDeepLoading(true);
    // Include firstName/lastName so they survive the formData replace in reassess.
    const nameFields = emailCapture.firstName
      ? { firstName: emailCapture.firstName, lastName: emailCapture.lastName }
      : {};
    const full = { ...lightAnswers, ...deepAnswers, ...nameFields };
    try {
      const result = await runAssessment({ ...lightAnswers, ...deepAnswers }, turnstileTokenRef.current);
      setFullResult(result);
      // Await: the deep evidence MUST persist before the result/consent step,
      // or the lead is stranded with light-only data and can never reach M7.
      await updateLead(result, full);
      setPhase("result");
    } catch {
      // Assessment API failed — still persist the deep answers (with the
      // preliminary assessment) so the deep evidence isn't silently lost.
      setFullResult(prelimResult);
      if (prelimResult) await updateLead(prelimResult, full);
      setPhase("result");
    } finally {
      setDeepLoading(false);
    }
  };

  const reset = () => {
    setPhase("light");
    setLightAnswers({ ...EMPTY_LIGHT });
    setDeepAnswers({ ...EMPTY_DEEP });
    setEmailCapture({ email: "", firstName: "", lastName: "" });
    setPrelimResult(null);
    setFullResult(null);
    setLeadId(null);
    setResultToken(null);
  };

  if (phase === "light") {
    return (
      <LightWizard
        answers={lightAnswers}
        onChange={(id, val) => setLightAnswers((prev) => ({ ...prev, [id]: val }))}
        onComplete={onLightComplete}
      />
    );
  }

  if (phase === "email") {
    return (
      <EmailGate
        assessmentRef={assessmentRef}
        onComplete={onEmailComplete}
        onReassess={onReassess}
      />
    );
  }

  if (phase === "preliminary" && prelimResult) {
    return (
      <PreliminaryResult
        result={prelimResult}
        onOptIn={onOptIn}
        onDecline={onDecline}
      />
    );
  }

  if (phase === "deep") {
    if (deepLoading) {
      return (
        <AssessmentLoader
          title="Building your full assessment"
          captions={[
            "Weighing your recognition & standing",
            "Mapping all three Dhanasar prongs",
            "Finalizing your full assessment",
          ]}
        />
      );
    }
    return (
      <DeepWizard
        answers={deepAnswers}
        onChange={(id, val) => setDeepAnswers((prev) => ({ ...prev, [id]: val }))}
        onComplete={onDeepComplete}
        lightStepCount={LIGHT_STEPS.length}
      />
    );
  }

  if (phase === "result" && fullResult) {
    return <FullResult result={fullResult} onReset={reset} leadId={leadId ?? undefined} resultToken={resultToken ?? undefined} />;
  }

  // Declined — show preliminary result as final (read-only, no opt-in offer)
  if (phase === "declined" && prelimResult) {
    return <FullResult result={prelimResult} onReset={reset} leadId={leadId ?? undefined} resultToken={resultToken ?? undefined} />;
  }

  return null;
}
