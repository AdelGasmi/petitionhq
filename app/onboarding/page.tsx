"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ---------------------------------------------------------------------------
// Attorney-only onboarding — applicants enter via /check → lead capture
// ---------------------------------------------------------------------------

const PETITION_TYPES = [
  {
    formId: "i140-niw",
    label: "EB-2 National Interest Waiver",
    badge: "Most common",
    icon: "🎓",
    description:
      "Self-petition NIW cases. AI-assisted drafting for all three Dhanasar prongs, evidence extraction, and recommendation letter management.",
    tags: ["NIW", "Employment-based", "EB-2"],
  },
  {
    formId: "i485",
    label: "Adjustment of Status",
    badge: null,
    icon: "🏠",
    description:
      "Manage I-485 filings from within the US, including companion I-765 and I-131 filings.",
    tags: ["I-485", "Adjustment", "Green card"],
  },
  {
    formId: "i130-f2a",
    label: "Family Petition (I-130 F2A)",
    badge: null,
    icon: "👨‍👩‍👧",
    description:
      "Petition for spouses and unmarried children of lawful permanent residents.",
    tags: ["Family-based", "F2A", "I-130"],
  },
  {
    formId: "n400",
    label: "Naturalization (N-400)",
    badge: null,
    icon: "🗽",
    description:
      "Guide clients through the N-400 naturalization application and interview preparation.",
    tags: ["Citizenship", "N-400"],
  },
] as const;

type PlanId = "standard" | "pro" | "firm";

const PLANS: {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  highlight: boolean;
  description: string;
  features: string[];
  cta: string;
}[] = [
  {
    id: "standard",
    name: "Standard",
    price: "$150",
    period: "/ month",
    highlight: false,
    description: "For solo practitioners handling up to 20 NIW cases per year.",
    features: [
      "AI-drafted NIW brief sections (all 3 prongs)",
      "Recommendation letter drafting + quality scoring",
      "Evidence extraction from CV uploads",
      "Exhibit plan generator",
      "2 qualified lead claims per month",
      "Secure client intake links",
    ],
    cta: "Start 30-day trial",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$350",
    period: "/ month",
    highlight: true,
    description: "For boutique firms managing 20–100 cases. Multi-attorney access.",
    features: [
      "Everything in Standard",
      "5 qualified lead claims per month",
      "Multi-attorney workspace",
      "Priority lead notifications",
      "Advanced evidence analytics",
      "$75 per additional lead claim",
    ],
    cta: "Start 30-day trial",
  },
  {
    id: "firm",
    name: "Firm",
    price: "$800",
    period: "/ month",
    highlight: false,
    description: "For established immigration firms with a high-volume NIW practice.",
    features: [
      "Everything in Pro",
      "15 lead claims per month",
      "Bulk case import",
      "Custom intake branding",
      "Dedicated onboarding call",
      "$50 per additional lead claim",
    ],
    cta: "Contact us",
  },
];

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function Steps({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-0">
      {[
        { n: 1, label: "Practice type" },
        { n: 2, label: "Choose a plan" },
      ].map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
            s.n < current  ? "bg-brand-primary text-white"
            : s.n === current ? "border-2 border-brand-primary text-text-primary"
            : "border-2 border-border-default text-text-muted"
          }`}>
            {s.n < current ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            ) : s.n}
          </div>
          <span className={`ml-2 text-xs ${s.n === current ? "font-medium text-text-primary" : "text-text-muted"}`}>
            {s.label}
          </span>
          {i === 0 && <div className={`mx-3 h-px w-12 ${s.n < current ? "bg-brand-primary" : "bg-surface-muted"}`} />}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!selectedForm || !selectedPlan) return;
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: selectedPlan, formId: selectedForm }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    router.push(`/cases/${data.caseId}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 space-y-10">

      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
          <span className="text-sm font-semibold">US</span>
        </div>
        <h1 className="font-serif text-3xl tracking-tight">Set up your practice</h1>
        <p className="text-text-muted text-sm">
          Tell us about your cases and choose a plan. Takes 2 minutes.
        </p>
      </div>

      {/* Steps */}
      <div className="flex justify-center">
        <Steps current={step} />
      </div>

      {/* ── Step 1: Practice type ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-xl">What type of cases does your firm primarily handle?</h2>
            <p className="mt-1 text-sm text-text-muted">This determines which AI drafting tools and templates are activated for your account.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {PETITION_TYPES.map((p) => {
              const selected = selectedForm === p.formId;
              return (
                <button
                  key={p.formId}
                  type="button"
                  onClick={() => setSelectedForm(p.formId)}
                  className={`relative rounded-2xl border-2 p-5 text-left transition-all ${
                    selected
                      ? "border-brand-primary bg-surface-subtle shadow-md"
                      : "border-border-default bg-surface-card hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  {p.badge && (
                    <span className="absolute right-4 top-4 rounded-full bg-brand-primary px-2 py-0.5 text-[10px] font-medium text-white">
                      {p.badge}
                    </span>
                  )}
                  {selected && (
                    <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-brand-primary">
                      <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                  )}
                  <div className="mb-3 text-2xl">{p.icon}</div>
                  <div className="font-semibold text-text-primary text-sm leading-snug">{p.label}</div>
                  <p className="mt-2 text-xs text-text-muted leading-relaxed">{p.description}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {p.tags.map((t) => (
                      <span key={t} className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-text-secondary">
                        {t}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              className="btn btn-primary px-8"
              disabled={!selectedForm}
              onClick={() => setStep(2)}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Plan ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="font-serif text-xl">Choose your plan</h2>
            <p className="mt-1 text-sm text-text-muted">
              All plans include a 30-day free trial. No credit card required to start.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => {
              const selected = selectedPlan === plan.id;
              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative cursor-pointer rounded-2xl border-2 p-6 transition-all ${
                    plan.highlight && !selected
                      ? "border-border-inverted bg-brand-primary text-white shadow-xl"
                      : selected
                      ? "border-brand-primary bg-surface-subtle shadow-lg"
                      : "border-border-default bg-surface-card hover:border-border-strong hover:shadow-sm"
                  }`}
                >
                  {plan.highlight && !selected && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-surface-card px-3 py-0.5 text-xs font-semibold text-text-primary shadow">
                      Most popular
                    </span>
                  )}
                  {selected && (
                    <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary">
                      <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </span>
                  )}

                  <div className={`text-sm font-semibold uppercase tracking-wide ${plan.highlight && !selected ? "text-text-muted" : "text-text-muted"}`}>
                    {plan.name}
                  </div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={`font-serif text-4xl font-bold ${plan.highlight && !selected ? "text-white" : "text-text-primary"}`}>
                      {plan.price}
                    </span>
                    <span className={`text-sm ${plan.highlight && !selected ? "text-text-muted" : "text-text-muted"}`}>
                      {plan.period}
                    </span>
                  </div>
                  <p className={`mt-3 text-sm leading-relaxed ${plan.highlight && !selected ? "text-text-disabled" : "text-text-muted"}`}>
                    {plan.description}
                  </p>

                  <ul className="mt-5 space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <svg className={`mt-0.5 h-4 w-4 shrink-0 ${plan.highlight && !selected ? "text-text-muted" : "text-text-muted"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        <span className={plan.highlight && !selected ? "text-text-disabled" : "text-text-secondary"}>
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {error && <p className="text-center text-sm text-danger-fill">{error}</p>}

          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-text-muted hover:text-text-secondary"
              onClick={() => setStep(1)}
            >
              ← Back
            </button>
            <button
              type="button"
              className="btn btn-primary px-8"
              disabled={!selectedPlan || submitting}
              onClick={submit}
            >
              {submitting ? "Setting up your workspace…" : "Start free trial →"}
            </button>
          </div>

          <p className="text-center text-xs text-text-muted">
            No credit card required.{" "}
            <button type="button" onClick={submit} className="underline hover:text-text-secondary" disabled={submitting}>
              Skip plan selection
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
