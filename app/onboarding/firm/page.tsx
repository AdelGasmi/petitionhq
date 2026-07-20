"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SPECIALTIES = ["NIW", "EB-1A", "O-1A", "EB-1B", "EB-2", "EB-3", "H-1B", "L-1"];

const PLANS = [
  {
    id: "pilot",
    label: "Pilot",
    price: "Free",
    description: "Try the platform with 3 trial cases. No subscription, by invitation only.",
  },
  {
    id: "standard",
    label: "Case management seat",
    price: "$99/mo",
    description: "Full attorney workspace. Cases billed at $150 each via Stripe Checkout when you claim them.",
  },
];

export default function FirmOnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [firmName, setFirmName] = useState("");
  const [website, setWebsite] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [plan, setPlan] = useState("pilot");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const toggleSpecialty = (s: string) =>
    setSelectedSpecialties((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/firm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firmName, website, specialties: selectedSpecialties, plan }),
      });
      const data = (await res.json()) as { ok: boolean; checkoutUrl?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed");
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push("/network/leads?onboarded=1");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg py-12 space-y-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Join the attorney network</h1>
        <p className="mt-1 text-sm text-text-muted">Set up your firm profile to start receiving leads.</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center font-semibold text-xs ${step >= s ? "bg-brand-primary text-white" : "border border-border-default text-text-muted"}`}>
              {s}
            </div>
            {s < 3 && <div className={`h-px w-8 ${step > s ? "bg-brand-primary" : "bg-surface-muted"}`} />}
          </div>
        ))}
        <span className="ml-2">{step === 1 ? "Firm details" : step === 2 ? "Plan" : "Confirm"}</span>
      </div>

      {/* Step 1: Firm info */}
      {step === 1 && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Firm name</label>
            <input
              type="text"
              value={firmName}
              onChange={(e) => setFirmName(e.target.value)}
              placeholder="Doe Immigration PLLC"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Website <span className="text-text-muted font-normal">(optional)</span></label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://doeimmigration.com"
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Specialties</label>
            <div className="filter-pill-row">
              {SPECIALTIES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialty(s)}
                  className="filter-pill"
                  aria-pressed={selectedSpecialties.includes(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!firmName.trim()}
            className="btn btn-primary w-full"
          >
            Continue →
          </button>
          {!firmName.trim() && (
            <p className="text-xs text-text-muted text-center">Enter your firm name to continue</p>
          )}
        </div>
      )}

      {/* Step 2: Plan selection */}
      {step === 2 && (
        <div className="space-y-4">
          {PLANS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlan(p.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${plan === p.id ? "border-border-inverted bg-surface-subtle" : "border-border-default hover:border-border-default"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-text-primary">{p.label}</span>
                <span className="font-bold text-text-secondary">{p.price}</span>
              </div>
              <p className="mt-1 text-sm text-text-muted">{p.description}</p>
            </button>
          ))}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(1)} className="btn btn-secondary flex-1">← Back</button>
            <button type="button" onClick={() => setStep(3)} className="btn btn-primary flex-1">Continue →</button>
          </div>
        </div>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="rounded-xl border border-border-default bg-surface-subtle p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-text-muted">Firm</span><span className="font-medium">{firmName}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Specialties</span><span className="font-medium">{selectedSpecialties.join(", ") || "—"}</span></div>
            <div className="flex justify-between"><span className="text-text-muted">Plan</span><span className="font-medium">{PLANS.find((p) => p.id === plan)?.label}</span></div>
          </div>
          {plan === "pilot" && (
            <p className="text-sm text-text-muted rounded-lg bg-warning-bg border border-warning-border px-4 py-3">
              Pilot accounts are manually approved. You&apos;ll receive an email within 24 hours to confirm your 3 trial cases.
            </p>
          )}
          {plan === "standard" && (
            <p className="text-sm text-text-muted">
              You&apos;ll be redirected to Stripe to start the $99/mo seat. Cases are billed at $150 each when you claim them — no commitment.
            </p>
          )}
          {error && <p className="text-sm text-danger-fill">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="btn btn-secondary flex-1">← Back</button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn btn-primary flex-1"
            >
              {submitting ? "Saving…" : plan === "standard" ? "Continue to payment →" : "Confirm & join →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
