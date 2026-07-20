"use client";

import { useState, type FormEvent } from "react";

interface FormState {
  name: string;
  email: string;
  firmName: string;
  niwExperience: string;
  phone: string;
  howHeard: string;
}

const INITIAL: FormState = {
  name: "",
  email: "",
  firmName: "",
  niwExperience: "",
  phone: "",
  howHeard: "",
};

export function AttorneyApplicationForm() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/attorney-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }
      setStatus("success");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-lg bg-surface-card p-6 text-center">
        <p className="font-serif text-xl font-bold text-text-primary">Application received</p>
        <p className="mt-2 text-sm text-text-secondary">
          Thank you, {form.name.split(" ")[0]}. We will review your application and reach out within two business days.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5 grid-cols-1 sm:grid-cols-2">
      <div>
        <label htmlFor="att-name" className="field-label text-text-inverted">Full name <span className="field-required">*</span></label>
        <input id="att-name" type="text" required value={form.name} onChange={set("name")} className="input" placeholder="Jane Doe" />
      </div>

      <div>
        <label htmlFor="att-email" className="field-label text-text-inverted">Work email <span className="field-required">*</span></label>
        <input id="att-email" type="email" required value={form.email} onChange={set("email")} className="input" placeholder="jane@example.com" />
      </div>

      <div>
        <label htmlFor="att-firm" className="field-label text-text-inverted">Law firm name <span className="field-required">*</span></label>
        <input id="att-firm" type="text" required value={form.firmName} onChange={set("firmName")} className="input" placeholder="Doe Immigration PLLC" />
      </div>

      <div>
        <label htmlFor="att-exp" className="field-label text-text-inverted">EB-2 NIW experience</label>
        <select id="att-exp" value={form.niwExperience} onChange={set("niwExperience")} className="select">
          <option value="">Select...</option>
          <option value="none">New to EB-2 NIW</option>
          <option value="1-5">1–5 NIW petitions filed</option>
          <option value="6-20">6–20 NIW petitions filed</option>
          <option value="20+">20+ NIW petitions filed</option>
        </select>
      </div>

      <div>
        <label htmlFor="att-phone" className="field-label text-text-inverted">Phone (optional)</label>
        <input id="att-phone" type="tel" value={form.phone} onChange={set("phone")} className="input" placeholder="+1 (555) 000-0000" />
      </div>

      <div>
        <label htmlFor="att-how" className="field-label text-text-inverted">How did you hear about us?</label>
        <input id="att-how" type="text" value={form.howHeard} onChange={set("howHeard")} className="input" placeholder="Referral, search, conference..." />
      </div>

      <div className="sm:col-span-2">
        {status === "error" && (
          <p className="mb-3 text-sm text-danger-fill font-medium">{errorMsg}</p>
        )}
        <button type="submit" className="btn btn-inverted btn-lg w-full sm:w-auto" data-loading={status === "submitting"}>
          Submit application
        </button>
      </div>
    </form>
  );
}
