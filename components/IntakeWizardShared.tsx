"use client";

// Shared types, constants, helpers, and step components used by both
// IntakeWizard (authenticated) and TokenIntakeWizard (unauthenticated).
// Neither wizard file should duplicate anything defined here.

import { useState } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const NSTC_CATEGORIES = [
  "Advanced AI, Machine Learning, and Autonomy",
  "Advanced Computing and Semiconductor Technology",
  "Advanced Engineering Materials",
  "Advanced Gas Turbine Engine Technology",
  "Advanced Manufacturing",
  "Advanced Networked Sensing and Signature Management",
  "Advanced Nuclear Energy Technologies",
  "Artificial Intelligence",
  "Autonomous Systems and Robotics",
  "Biotechnologies",
  "Communication and Networking Technologies",
  "Directed Energy",
  "Financial Technologies",
  "Human-Machine Interfaces",
  "Hypersonics",
  "Quantum Information Science and Technology",
  "Renewable Energy Generation and Storage",
  "Space Technologies and Systems",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FederalProgram = { programName: string; agencyOrOffice: string; specificGoal: string };
export type USCollaborator = { name: string; institution: string; role: string };
export type USMilestone = { description: string; timeline: string };
export type USFundingSource = { source: string; status: string };
export type USPlan = {
  institution: string;
  collaborators: USCollaborator[];
  milestones: USMilestone[];
  fundingSources: USFundingSource[];
};
export type Publication = {
  title: string; venue: string; year: string; citations: string;
  impactFactor: string; journalRank: string; citationPercentile: string; esiFieldAverage: string;
};
export type NotableCitation = { citingAuthor: string; citingJournal: string; citingYear: string; howUsed: string };
export type Award = { name: string; issuer: string; year: string };
export type Grant = { title: string; agency: string; amount: string };
export type EditorialRole = { journal: string; role: string };
export type Talk = { title: string; venue: string };
export type Recommender = {
  name: string; title: string; institution: string;
  credentials: string; relationship: string; email: string;
  kind: "independent" | "dependent";
};

// Fields shared by both wizards (qualifications + endeavor)
export type SharedIntakeData = {
  highestDegree: string;
  degreeInstitution: string;
  degreeYear: string;
  degreeField: string;
  publications: Publication[];
  notableCitations: NotableCitation[];
  awards: Award[];
  grants: Grant[];
  editorialRoles: EditorialRole[];
  invitedTalks: Talk[];
  endeavorField: string;
  endeavorPartA: string;
  endeavorPartB: string;
  endeavorPartC: string;
  endeavorPartD: string;
  endeavorStatement: string;
  nationalImportanceArgument: string;
  nstcCategories: string[];
  federalPrograms: FederalProgram[];
  researchIsPublished: boolean;
  usPlan: USPlan;
  recommenders: Recommender[];
  _existingQualifications: Record<string, unknown>;
};

// Personal info — main wizard only
export type PersonalInfoFields = {
  familyName: string;
  givenName: string;
  middleName: string;
  dob: string;
  cityOfBirth: string;
  countryOfBirth: string;
  countryOfCitizenship: string;
  currentStatus: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  phone: string;
  email: string;
  passportNumber: string;
  passportCountry: string;
  passportExpiry: string;
};

export type FullIntakeData = SharedIntakeData & PersonalInfoFields;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function num(s: string): number | undefined {
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

export function buildQualificationsPayload(data: SharedIntakeData) {
  return {
    ...data._existingQualifications,
    highestDegree: data.highestDegree || undefined,
    degreeInstitution: data.degreeInstitution || undefined,
    degreeYear: num(data.degreeYear),
    degreeField: data.degreeField || undefined,
    publications: data.publications
      .filter((p) => p.title.trim())
      .map((p) => ({
        title: p.title.trim(),
        venue: p.venue.trim() || undefined,
        year: num(p.year),
        citations: num(p.citations),
        impactFactor: p.impactFactor.trim() ? parseFloat(p.impactFactor) : undefined,
        journalRank: p.journalRank.trim() || undefined,
        citationPercentile: p.citationPercentile.trim() ? parseFloat(p.citationPercentile) : undefined,
        esiFieldAverage: p.esiFieldAverage.trim() ? parseFloat(p.esiFieldAverage) : undefined,
      })),
    notableCitations: data.notableCitations
      .filter((c) => c.citingAuthor.trim() || c.citingJournal.trim())
      .map((c) => ({
        citingAuthor: c.citingAuthor.trim() || undefined,
        citingJournal: c.citingJournal.trim() || undefined,
        citingYear: num(c.citingYear),
        howUsed: c.howUsed.trim() || undefined,
      })),
    awards: data.awards
      .filter((a) => a.name.trim())
      .map((a) => ({ name: a.name.trim(), issuer: a.issuer.trim() || undefined, year: num(a.year) })),
    grants: data.grants
      .filter((g) => g.title.trim())
      .map((g) => ({ title: g.title.trim(), agency: g.agency.trim() || undefined, amount: g.amount.trim() || undefined })),
    editorialRoles: data.editorialRoles
      .filter((r) => r.journal.trim())
      .map((r) => ({ journal: r.journal.trim(), role: r.role.trim() || undefined })),
    invitedTalks: data.invitedTalks
      .filter((t) => t.title.trim())
      .map((t) => ({ title: t.title.trim(), venue: t.venue.trim() || undefined })),
  };
}

export function buildEndeavorPayload(data: SharedIntakeData) {
  return {
    endeavorField: data.endeavorField.trim() || undefined,
    endeavorPartA: data.endeavorPartA.trim() || undefined,
    endeavorPartB: data.endeavorPartB.trim() || undefined,
    endeavorPartC: data.endeavorPartC.trim() || undefined,
    endeavorPartD: data.endeavorPartD.trim() || undefined,
    endeavorStatement: [data.endeavorPartA, data.endeavorPartB, data.endeavorPartC, data.endeavorPartD]
      .map(s => s.trim()).filter(Boolean).join(" ") || undefined,
    nationalImportanceArgument: data.nationalImportanceArgument.trim() || undefined,
    nstcCategories: data.nstcCategories.length ? data.nstcCategories : undefined,
    federalPrograms: data.federalPrograms.filter(p => p.programName.trim()).map(p => ({
      programName: p.programName.trim(),
      agencyOrOffice: p.agencyOrOffice.trim() || undefined,
      specificGoal: p.specificGoal.trim() || undefined,
    })),
    researchIsPublished: data.researchIsPublished,
    usPlan: {
      institution: data.usPlan.institution.trim() || undefined,
      collaborators: data.usPlan.collaborators.filter(c => c.name.trim()).map(c => ({
        name: c.name.trim(), institution: c.institution.trim() || undefined, role: c.role.trim() || undefined,
      })),
      milestones: data.usPlan.milestones.filter(m => m.description.trim()).map(m => ({
        description: m.description.trim(), timeline: m.timeline.trim() || undefined,
      })),
      fundingSources: data.usPlan.fundingSources.filter(f => f.source.trim()).map(f => ({
        source: f.source.trim(), status: f.status.trim() || undefined,
      })),
    },
  };
}

export function buildRecommendersPayload(data: SharedIntakeData) {
  return data.recommenders
    .filter((r) => r.name.trim())
    .map((r) => ({
      name: r.name.trim(),
      title: r.title.trim() || undefined,
      institution: r.institution.trim() || undefined,
      credentials: r.credentials.trim() || undefined,
      relationship: r.relationship.trim() || undefined,
      email: r.email.trim() || undefined,
      kind: r.kind,
    }));
}

// ---------------------------------------------------------------------------
// Validation — main wizard only (token wizard has no required fields)
// ---------------------------------------------------------------------------

export function validateStep(step: number, data: FullIntakeData): string[] {
  const errs: string[] = [];
  if (step === 0) {
    if (!data.familyName.trim()) errs.push("Family name is required.");
    if (!data.givenName.trim()) errs.push("Given name is required.");
    if (!data.dob.trim()) errs.push("Date of birth is required.");
    if (!data.countryOfBirth.trim()) errs.push("Country of birth is required.");
    if (!data.countryOfCitizenship.trim()) errs.push("Country of citizenship is required.");
    if (!data.addressStreet.trim() || !data.addressCity.trim()) errs.push("Current address (street and city) is required.");
  }
  if (step === 1) {
    if (!data.highestDegree) errs.push("Highest degree is required.");
    if (!data.degreeInstitution.trim()) errs.push("Degree institution is required.");
    if (!data.degreeField.trim()) errs.push("Field of study is required.");
  }
  if (step === 2) {
    if (!data.endeavorField.trim()) errs.push("Field / sub-field is required.");
    const hasBuilder = data.endeavorPartA.trim() && data.endeavorPartB.trim();
    if (!hasBuilder) errs.push("Complete at least Parts A and B of the endeavor builder — the assembled sentence is used verbatim in your petition.");
  }
  return errs;
}

// ---------------------------------------------------------------------------
// Primitive UI components
// ---------------------------------------------------------------------------

export function Label({ children, hint, required, optional }: {
  children: React.ReactNode; hint?: string; required?: boolean; optional?: boolean;
}) {
  return (
    <div className="mb-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-text-primary">
        {children}
        {required && <span className="text-xs font-normal text-danger-fill">required</span>}
        {optional && <span className="text-xs font-normal text-text-muted">optional</span>}
      </span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </div>
  );
}

export function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border-default text-text-muted">+</span>
      {label}
    </button>
  );
}

export function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 text-xs text-text-disabled hover:text-danger-fill transition-colors mt-1"
      title="Remove"
    >
      ✕
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step components — typed against SharedIntakeData
// ---------------------------------------------------------------------------

type SetFn = (k: keyof SharedIntakeData, v: unknown) => void;

export function StepBasis({ data, set }: { data: SharedIntakeData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <div>
        <Label required>Highest degree</Label>
        <select className="input text-sm" value={data.highestDegree} onChange={(e) => set("highestDegree", e.target.value)}>
          <option value="">Select…</option>
          <option value="phd">PhD / Doctorate</option>
          <option value="md">MD / Medical degree</option>
          <option value="masters">Master's</option>
          <option value="bachelors+5">Bachelor's + 5 yrs progressive experience</option>
          <option value="exceptional-ability">Exceptional ability (no advanced degree)</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label required>Institution</Label>
          <input className="input text-sm" placeholder="e.g. MIT, Stanford" value={data.degreeInstitution} onChange={(e) => set("degreeInstitution", e.target.value)} />
        </div>
        <div>
          <Label optional>Year conferred</Label>
          <input className="input text-sm" placeholder="e.g. 2019" value={data.degreeYear} onChange={(e) => set("degreeYear", e.target.value)} />
        </div>
      </div>
      <div>
        <Label required hint="Be specific — this goes directly into your petition brief">Field of study / specialization</Label>
        <input className="input text-sm" placeholder="e.g. Formal Verification of Machine Learning Systems" value={data.degreeField} onChange={(e) => set("degreeField", e.target.value)} />
      </div>
    </div>
  );
}

export function StepEndeavor({ data, set }: { data: SharedIntakeData; set: SetFn }) {
  const assembled = [data.endeavorPartA, data.endeavorPartB, data.endeavorPartC, data.endeavorPartD]
    .map(s => s.trim()).filter(Boolean).join(" ");

  const toggleNstc = (cat: string) => {
    const next = data.nstcCategories.includes(cat)
      ? data.nstcCategories.filter(c => c !== cat)
      : [...data.nstcCategories, cat];
    set("nstcCategories", next);
  };

  const addProgram = () => set("federalPrograms", [...data.federalPrograms, { programName: "", agencyOrOffice: "", specificGoal: "" }]);
  const removeProgram = (i: number) => set("federalPrograms", data.federalPrograms.filter((_, idx) => idx !== i));
  const updateProgram = (i: number, field: keyof FederalProgram, val: string) =>
    set("federalPrograms", data.federalPrograms.map((p, idx) => idx === i ? { ...p, [field]: val } : p));

  return (
    <div className="space-y-6">
      <div>
        <Label required hint="The sub-field your US work will focus on">Field / sub-field</Label>
        <input className="input text-sm" placeholder="e.g. AI safety, structural oncology, green hydrogen catalysis" value={data.endeavorField} onChange={(e) => set("endeavorField", e.target.value)} />
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Proposed endeavor <span className="text-danger-fill text-xs font-normal">required</span></h4>
          <p className="text-xs text-text-muted mt-0.5">Build it in four parts — assembled sentence is used verbatim throughout your petition.</p>
        </div>
        <div className="rounded-lg border border-border-default bg-surface-subtle p-4 space-y-3">
          <div>
            <Label required hint='Methodology or approach. e.g. "developing a dual-pipeline framework coupling ML models with experimental synthesis"'>Part A — What you do</Label>
            <textarea className="input text-sm min-h-[68px] leading-relaxed" placeholder="developing a dual-pipeline framework coupling unsupervised machine learning models with targeted experimental synthesis and electrochemical validation" value={data.endeavorPartA} onChange={(e) => set("endeavorPartA", e.target.value)} />
          </div>
          <div>
            <Label required hint='Immediate technical target. e.g. "to accelerate the discovery of earth-abundant electrocatalysts"'>Part B — Immediate technical objective</Label>
            <textarea className="input text-sm min-h-[60px] leading-relaxed" placeholder="to accelerate the discovery and design of earth-abundant, non-precious metal electrocatalysts for hydrogen evolution reactions" value={data.endeavorPartB} onChange={(e) => set("endeavorPartB", e.target.value)} />
          </div>
          <div>
            <Label optional hint='What this eliminates or makes possible. e.g. "in order to eliminate reliance on scarce platinum group metals"'>Part C — What it eliminates / enables</Label>
            <textarea className="input text-sm min-h-[60px] leading-relaxed" placeholder="in order to eliminate reliance on scarce platinum group metals, thereby drastically reducing the cost of sustainable green hydrogen production" value={data.endeavorPartC} onChange={(e) => set("endeavorPartC", e.target.value)} />
          </div>
          <div>
            <Label optional hint='Ultimate national benefit. e.g. "to enable the decarbonization of hard-to-abate industrial sectors"'>Part D — Ultimate national benefit</Label>
            <textarea className="input text-sm min-h-[60px] leading-relaxed" placeholder="to enable the decarbonization of hard-to-abate industrial sectors critical to US energy security" value={data.endeavorPartD} onChange={(e) => set("endeavorPartD", e.target.value)} />
          </div>
        </div>
        {assembled && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 mb-1.5">Assembled sentence ↓ will appear verbatim in your petition</p>
            <p className="text-sm leading-relaxed text-emerald-900 italic">"{assembled}"</p>
          </div>
        )}
      </div>

      <div>
        <Label optional hint="Which US federal priority, agency initiative, or documented national need does your work address?">Why is this nationally important?</Label>
        <textarea className="input min-h-[90px] text-sm leading-relaxed" placeholder="e.g. The White House Executive Order on AI Safety (Oct 2023) mandates development of safety standards for AI in critical sectors…" value={data.nationalImportanceArgument} onChange={(e) => set("nationalImportanceArgument", e.target.value)} />
      </div>

      <div className="border-t border-border-subtle pt-5">
        <h4 className="text-sm font-semibold text-text-primary mb-1">NSTC Critical & Emerging Technology categories <span className="font-normal text-text-muted text-xs">optional</span></h4>
        <p className="text-xs text-text-muted mb-3">USCIS recognizes this 2024 list in its Policy Manual. Selecting a matching category is a direct Prong 1 anchor.</p>
        <div className="space-y-1.5">
          {NSTC_CATEGORIES.map(cat => (
            <label key={cat} className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" className="accent-stone-800" checked={data.nstcCategories.includes(cat)} onChange={() => toggleNstc(cat)} />
              <span className="text-sm text-text-secondary">{cat}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t border-border-subtle pt-5 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Federal program alignment <span className="font-normal text-text-muted text-xs">optional</span></h4>
          <p className="text-xs text-text-muted">Named US government programs that directly fund or call for work like yours. Cited verbatim in Prong 1.</p>
        </div>
        {data.federalPrograms.map((fp, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Program {i + 1}</span>
              <RemoveButton onClick={() => removeProgram(i)} />
            </div>
            <div>
              <Label required>Program name</Label>
              <input className="input text-sm" placeholder="e.g. DOE Hydrogen Shot" value={fp.programName} onChange={(e) => updateProgram(i, "programName", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label optional>Agency / office</Label>
                <input className="input text-sm" placeholder="e.g. U.S. Department of Energy" value={fp.agencyOrOffice} onChange={(e) => updateProgram(i, "agencyOrOffice", e.target.value)} />
              </div>
              <div>
                <Label optional hint="Specific measurable target from the program">Specific goal / target</Label>
                <input className="input text-sm" placeholder="e.g. $1/kg clean hydrogen by 2031" value={fp.specificGoal} onChange={(e) => updateProgram(i, "specificGoal", e.target.value)} />
              </div>
            </div>
          </div>
        ))}
        <AddButton onClick={addProgram} label="Add program" />
      </div>

      <div className="border-t border-border-subtle pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-0.5 accent-stone-800" checked={data.researchIsPublished} onChange={(e) => set("researchIsPublished", e.target.checked)} />
          <div>
            <span className="text-sm font-medium text-text-primary">My research is published openly in peer-reviewed journals (not proprietary to one employer)</span>
            <p className="text-xs text-text-muted mt-0.5">When checked, the brief will include a broad dissemination argument.</p>
          </div>
        </label>
      </div>

      <USWorkPlanSection data={data} set={set} />
    </div>
  );
}

function USWorkPlanSection({ data, set }: { data: SharedIntakeData; set: SetFn }) {
  const [open, setOpen] = useState(false);
  const plan = data.usPlan;
  const hasContent = plan.institution || plan.collaborators.length > 0 || plan.milestones.length > 0 || plan.fundingSources.length > 0;

  const updatePlan = (patch: Partial<USPlan>) => set("usPlan", { ...plan, ...patch });

  return (
    <div className="border-t border-border-subtle pt-5">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <h4 className="text-sm font-semibold text-text-primary">
            US work plan <span className="font-normal text-text-muted text-xs">optional — addresses RFE trigger #2</span>
            {hasContent && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">filled</span>}
          </h4>
          <p className="text-xs text-text-muted mt-0.5">Where, with whom, and on what timeline will you do this work in the US?</p>
        </div>
        <span className={`ml-3 shrink-0 text-text-muted transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <div>
            <Label optional hint="e.g. MIT CSAIL, Stanford AI Lab, NIH Campus">Primary US institution / lab</Label>
            <input
              className="input text-sm"
              placeholder="e.g. MIT CSAIL"
              value={plan.institution}
              onChange={(e) => updatePlan({ institution: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-text-muted">US collaborators</h5>
            {plan.collaborators.map((c, i) => (
              <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Collaborator {i + 1}</span>
                  <RemoveButton onClick={() => updatePlan({ collaborators: plan.collaborators.filter((_, idx) => idx !== i) })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <input className="input text-sm" placeholder="Name" value={c.name} onChange={(e) => updatePlan({ collaborators: plan.collaborators.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x) })} />
                  <input className="input text-sm" placeholder="Institution" value={c.institution} onChange={(e) => updatePlan({ collaborators: plan.collaborators.map((x, idx) => idx === i ? { ...x, institution: e.target.value } : x) })} />
                  <input className="input text-sm" placeholder="What you'll do together" value={c.role} onChange={(e) => updatePlan({ collaborators: plan.collaborators.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x) })} />
                </div>
              </div>
            ))}
            <AddButton onClick={() => updatePlan({ collaborators: [...plan.collaborators, { name: "", institution: "", role: "" }] })} label="Add collaborator" />
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Milestones</h5>
            {plan.milestones.map((m, i) => (
              <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Milestone {i + 1}</span>
                  <RemoveButton onClick={() => updatePlan({ milestones: plan.milestones.filter((_, idx) => idx !== i) })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <input className="input text-sm" placeholder="Concrete deliverable" value={m.description} onChange={(e) => updatePlan({ milestones: plan.milestones.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x) })} />
                  </div>
                  <input className="input text-sm" placeholder="Timeline (e.g. Year 1)" value={m.timeline} onChange={(e) => updatePlan({ milestones: plan.milestones.map((x, idx) => idx === i ? { ...x, timeline: e.target.value } : x) })} />
                </div>
              </div>
            ))}
            <AddButton onClick={() => updatePlan({ milestones: [...plan.milestones, { description: "", timeline: "" }] })} label="Add milestone" />
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Funding sources</h5>
            {plan.fundingSources.map((f, i) => (
              <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Funding {i + 1}</span>
                  <RemoveButton onClick={() => updatePlan({ fundingSources: plan.fundingSources.filter((_, idx) => idx !== i) })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className="input text-sm" placeholder="e.g. NSF CAREER Award (pending)" value={f.source} onChange={(e) => updatePlan({ fundingSources: plan.fundingSources.map((x, idx) => idx === i ? { ...x, source: e.target.value } : x) })} />
                  <select className="input text-sm" value={f.status} onChange={(e) => updatePlan({ fundingSources: plan.fundingSources.map((x, idx) => idx === i ? { ...x, status: e.target.value } : x) })}>
                    <option value="">Status…</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="applied">Applied</option>
                  </select>
                </div>
              </div>
            ))}
            <AddButton onClick={() => updatePlan({ fundingSources: [...plan.fundingSources, { source: "", status: "" }] })} label="Add funding source" />
          </div>
        </div>
      )}
    </div>
  );
}

export function StepPublications({ data, set }: { data: SharedIntakeData; set: SetFn }) {
  const pubs = data.publications;
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const update = (i: number, field: keyof Publication, val: string) =>
    set("publications", pubs.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  const add = () => set("publications", [...pubs, { title: "", venue: "", year: "", citations: "", impactFactor: "", journalRank: "", citationPercentile: "", esiFieldAverage: "" }]);
  const remove = (i: number) => set("publications", pubs.filter((_, idx) => idx !== i));
  const toggleExpand = (i: number) => setExpanded((prev) => { const s = new Set(prev); s.has(i) ? s.delete(i) : s.add(i); return s; });

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">List your most significant peer-reviewed publications. These become the backbone of your Prong 1 argument.</p>
      {pubs.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-default px-4 py-6 text-center text-sm text-text-muted">
          No publications yet — click below to add your first.
        </p>
      )}
      {pubs.map((p, i) => (
        <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Publication {i + 1}</span>
            <RemoveButton onClick={() => remove(i)} />
          </div>
          <div>
            <Label required>Title</Label>
            <input className="input text-sm" placeholder="Full paper title" value={p.title} onChange={(e) => update(i, "title", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label optional>Journal / venue</Label>
              <input className="input text-sm" placeholder="e.g. NeurIPS 2023" value={p.venue} onChange={(e) => update(i, "venue", e.target.value)} />
            </div>
            <div>
              <Label optional>Year</Label>
              <input className="input text-sm" placeholder="2023" value={p.year} onChange={(e) => update(i, "year", e.target.value)} />
            </div>
            <div>
              <Label optional hint="Check Google Scholar">Citations</Label>
              <input className="input text-sm" placeholder="e.g. 142" value={p.citations} onChange={(e) => update(i, "citations", e.target.value)} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleExpand(i)}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            <span className={`transition-transform ${expanded.has(i) ? "rotate-90" : ""}`}>▶</span>
            {expanded.has(i) ? "Hide" : "Add"} impact details
            {(p.impactFactor || p.journalRank || p.citationPercentile) && (
              <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">filled</span>
            )}
          </button>
          {expanded.has(i) && (
            <div className="rounded-lg border border-border-default bg-surface-card px-4 py-4 space-y-3">
              <p className="text-xs text-text-muted">These values power the ESI-percentile and journal-ranking arguments in your brief. Find them on InCites or Journal Citation Reports.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label optional hint="e.g. 14.3 — from Journal Citation Reports">Journal impact factor (IF)</Label>
                  <input className="input text-sm" placeholder="e.g. 14.3" value={p.impactFactor} onChange={(e) => update(i, "impactFactor", e.target.value)} />
                </div>
                <div>
                  <Label optional hint="e.g. Q1, Top 5% in field — from SCImago or JCR">Journal rank / quartile</Label>
                  <input className="input text-sm" placeholder="e.g. Q1, Top 5%" value={p.journalRank} onChange={(e) => update(i, "journalRank", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label optional hint="Your citations vs. field average — from ESI. 0–100.">Citation percentile (ESI)</Label>
                  <input className="input text-sm" placeholder="e.g. 97.4" value={p.citationPercentile} onChange={(e) => update(i, "citationPercentile", e.target.value)} />
                </div>
                <div>
                  <Label optional hint="Average citations for papers in this ESI field and year">ESI field average citations</Label>
                  <input className="input text-sm" placeholder="e.g. 8.2" value={p.esiFieldAverage} onChange={(e) => update(i, "esiFieldAverage", e.target.value)} />
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <AddButton onClick={add} label="Add publication" />
    </div>
  );
}

export function StepRecognition({ data, set }: { data: SharedIntakeData; set: SetFn }) {
  const awards = data.awards;
  const grants = data.grants;
  const roles = data.editorialRoles;
  const talks = data.invitedTalks;
  const citations = data.notableCitations;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Awards & prizes <span className="font-normal text-text-muted text-xs">optional</span></h4>
          <p className="text-xs text-text-muted">Include field-specific or national recognition. Institutional awards count too.</p>
        </div>
        {awards.map((a, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Award {i + 1}</span>
              <RemoveButton onClick={() => set("awards", awards.filter((_, idx) => idx !== i))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <input className="input text-sm" placeholder="Award name" value={a.name} onChange={(e) => set("awards", awards.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} />
              </div>
              <div>
                <input className="input text-sm" placeholder="Issuing organization" value={a.issuer} onChange={(e) => set("awards", awards.map((x, idx) => idx === i ? { ...x, issuer: e.target.value } : x))} />
              </div>
              <div>
                <input className="input text-sm" placeholder="Year" value={a.year} onChange={(e) => set("awards", awards.map((x, idx) => idx === i ? { ...x, year: e.target.value } : x))} />
              </div>
            </div>
          </div>
        ))}
        <AddButton onClick={() => set("awards", [...awards, { name: "", issuer: "", year: "" }])} label="Add award" />
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Grants & funding <span className="font-normal text-text-muted text-xs">optional</span></h4>
          <p className="text-xs text-text-muted">NIH, NSF, DOE, DOD, private foundations — any competitive funding you received.</p>
        </div>
        {grants.map((g, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Grant {i + 1}</span>
              <RemoveButton onClick={() => set("grants", grants.filter((_, idx) => idx !== i))} />
            </div>
            <div>
              <input className="input text-sm" placeholder="Grant / project title" value={g.title} onChange={(e) => set("grants", grants.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input text-sm" placeholder="Funding agency (e.g. NSF)" value={g.agency} onChange={(e) => set("grants", grants.map((x, idx) => idx === i ? { ...x, agency: e.target.value } : x))} />
              <input className="input text-sm" placeholder="Amount (e.g. $450,000)" value={g.amount} onChange={(e) => set("grants", grants.map((x, idx) => idx === i ? { ...x, amount: e.target.value } : x))} />
            </div>
          </div>
        ))}
        <AddButton onClick={() => set("grants", [...grants, { title: "", agency: "", amount: "" }])} label="Add grant" />
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Editorial & peer review roles <span className="font-normal text-text-muted text-xs">optional</span></h4>
          <p className="text-xs text-text-muted">Journals you review for, editorial board memberships, program committee roles.</p>
        </div>
        {roles.map((r, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Role {i + 1}</span>
              <RemoveButton onClick={() => set("editorialRoles", roles.filter((_, idx) => idx !== i))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input text-sm" placeholder="Journal / conference" value={r.journal} onChange={(e) => set("editorialRoles", roles.map((x, idx) => idx === i ? { ...x, journal: e.target.value } : x))} />
              <input className="input text-sm" placeholder="Role (e.g. Reviewer, Associate Editor)" value={r.role} onChange={(e) => set("editorialRoles", roles.map((x, idx) => idx === i ? { ...x, role: e.target.value } : x))} />
            </div>
          </div>
        ))}
        <AddButton onClick={() => set("editorialRoles", [...roles, { journal: "", role: "" }])} label="Add role" />
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Invited talks <span className="font-normal text-text-muted text-xs">optional</span></h4>
          <p className="text-xs text-text-muted">Keynotes, invited sessions, seminar talks at other institutions.</p>
        </div>
        {talks.map((t, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Talk {i + 1}</span>
              <RemoveButton onClick={() => set("invitedTalks", talks.filter((_, idx) => idx !== i))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input className="input text-sm" placeholder="Talk title" value={t.title} onChange={(e) => set("invitedTalks", talks.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))} />
              <input className="input text-sm" placeholder="Event / institution" value={t.venue} onChange={(e) => set("invitedTalks", talks.map((x, idx) => idx === i ? { ...x, venue: e.target.value } : x))} />
            </div>
          </div>
        ))}
        <AddButton onClick={() => set("invitedTalks", [...talks, { title: "", venue: "" }])} label="Add talk" />
      </div>

      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-text-primary">Notable citations <span className="font-normal text-text-muted text-xs">optional — high impact</span></h4>
          <p className="text-xs text-text-muted">
            Specific instances where a named researcher, government agency, or major report cited your work.
            The brief will quote how they used it. One of the strongest Prong 2 arguments.
          </p>
        </div>
        {citations.map((c, i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Citation {i + 1}</span>
              <RemoveButton onClick={() => set("notableCitations", citations.filter((_, idx) => idx !== i))} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label optional hint="e.g. Prof. Jane Smith (Stanford) or CDC Technical Report">Citing author / source</Label>
                <input className="input text-sm" placeholder="Prof. Jane Smith" value={c.citingAuthor} onChange={(e) => set("notableCitations", citations.map((x, idx) => idx === i ? { ...x, citingAuthor: e.target.value } : x))} />
              </div>
              <div>
                <Label optional>Journal / document</Label>
                <input className="input text-sm" placeholder="e.g. Nature Medicine" value={c.citingJournal} onChange={(e) => set("notableCitations", citations.map((x, idx) => idx === i ? { ...x, citingJournal: e.target.value } : x))} />
              </div>
              <div>
                <Label optional>Year</Label>
                <input className="input text-sm" placeholder="2024" value={c.citingYear} onChange={(e) => set("notableCitations", citations.map((x, idx) => idx === i ? { ...x, citingYear: e.target.value } : x))} />
              </div>
            </div>
            <div>
              <Label optional hint="How exactly did they use your work? Quote or paraphrase.">How they used your work</Label>
              <textarea
                className="input text-sm min-h-[64px] leading-relaxed"
                placeholder='"adopted our method as the benchmark baseline for their FDA-funded validation study"'
                value={c.howUsed}
                onChange={(e) => set("notableCitations", citations.map((x, idx) => idx === i ? { ...x, howUsed: e.target.value } : x))}
              />
            </div>
          </div>
        ))}
        <AddButton onClick={() => set("notableCitations", [...citations, { citingAuthor: "", citingJournal: "", citingYear: "", howUsed: "" }])} label="Add notable citation" />
      </div>
    </div>
  );
}

// Personal info step — main wizard only
export function StepPersonalInfo({ data, set }: { data: FullIntakeData; set: (k: keyof FullIntakeData, v: unknown) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label required>Family name (last name)</Label>
          <input className="input text-sm" placeholder="As on passport" value={data.familyName} onChange={(e) => set("familyName", e.target.value)} />
        </div>
        <div>
          <Label required>Given name (first name)</Label>
          <input className="input text-sm" placeholder="As on passport" value={data.givenName} onChange={(e) => set("givenName", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label optional>Middle name</Label>
          <input className="input text-sm" value={data.middleName} onChange={(e) => set("middleName", e.target.value)} />
        </div>
        <div>
          <Label required>Date of birth</Label>
          <input type="date" className="input text-sm" value={data.dob} onChange={(e) => set("dob", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label required>Country of birth</Label>
          <input className="input text-sm" placeholder="e.g. Algeria, India, China" value={data.countryOfBirth} onChange={(e) => set("countryOfBirth", e.target.value)} />
        </div>
        <div>
          <Label required>Country of citizenship</Label>
          <input className="input text-sm" placeholder="e.g. Algeria" value={data.countryOfCitizenship} onChange={(e) => set("countryOfCitizenship", e.target.value)} />
        </div>
      </div>
      <div>
        <Label optional hint="e.g. H-1B, F-1, O-1 — leave blank if already an LPR">Current US immigration status</Label>
        <input className="input text-sm" placeholder="H-1B" value={data.currentStatus} onChange={(e) => set("currentStatus", e.target.value)} />
      </div>
      <div className="border-t border-border-subtle pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Current US mailing address</p>
        <div className="space-y-3">
          <div>
            <Label required>Street address</Label>
            <input className="input text-sm" placeholder="123 Main St" value={data.addressStreet} onChange={(e) => set("addressStreet", e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label required>City</Label>
              <input className="input text-sm" value={data.addressCity} onChange={(e) => set("addressCity", e.target.value)} />
            </div>
            <div>
              <Label optional>State</Label>
              <input className="input text-sm" placeholder="CA" value={data.addressState} onChange={(e) => set("addressState", e.target.value)} />
            </div>
            <div>
              <Label optional>ZIP</Label>
              <input className="input text-sm" placeholder="94102" value={data.addressZip} onChange={(e) => set("addressZip", e.target.value)} />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border-subtle pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">Contact & travel document</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label optional>Phone</Label>
            <input className="input text-sm" placeholder="+1 415 000 0000" value={data.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div>
            <Label optional>Email</Label>
            <input type="email" className="input text-sm" value={data.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <Label optional>Passport number</Label>
            <input className="input text-sm" value={data.passportNumber} onChange={(e) => set("passportNumber", e.target.value)} />
          </div>
          <div>
            <Label optional>Passport country</Label>
            <input className="input text-sm" value={data.passportCountry} onChange={(e) => set("passportCountry", e.target.value)} />
          </div>
          <div>
            <Label optional>Passport expiry</Label>
            <input type="date" className="input text-sm" value={data.passportExpiry} onChange={(e) => set("passportExpiry", e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step: Recommenders
// ---------------------------------------------------------------------------

const EMPTY_RECOMMENDER: Recommender = { name: "", title: "", institution: "", credentials: "", relationship: "", email: "", kind: "independent" };

type RecSetFn = (k: keyof SharedIntakeData, v: unknown) => void;

export function StepRecommenders({ data, set }: { data: SharedIntakeData; set: RecSetFn }) {
  const recs = data.recommenders;
  const update = (i: number, field: keyof Recommender, val: string) => {
    const next = [...recs];
    next[i] = { ...next[i], [field]: val };
    set("recommenders", next);
  };
  const add = (kind: "independent" | "dependent") => set("recommenders", [...recs, { ...EMPTY_RECOMMENDER, kind }]);
  const remove = (i: number) => set("recommenders", recs.filter((_, j) => j !== i));

  const independent = recs.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === "independent");
  const dependent = recs.map((r, i) => ({ r, i })).filter(({ r }) => r.kind === "dependent");

  return (
    <div className="space-y-8">
      <p className="text-sm text-text-secondary">
        Add the people who can write recommendation letters for your petition. Your attorney will handle drafting and sending the letters — you just need to provide their contact details and describe your relationship.
      </p>

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-text-primary">Independent recommenders</h3>
          <p className="text-xs text-text-muted mt-0.5">People who know your work by reputation but have NOT worked with you directly. Aim for 3–6.</p>
        </div>
        {independent.map(({ r, i }) => (
          <RecommenderCard key={i} rec={r} index={i} update={update} remove={remove} />
        ))}
        <AddButton onClick={() => add("independent")} label="Add independent recommender" />
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-text-primary">Dependent recommenders</h3>
          <p className="text-xs text-text-muted mt-0.5">People who have worked with you directly — advisors, supervisors, close collaborators. Aim for 1–3.</p>
        </div>
        {dependent.map(({ r, i }) => (
          <RecommenderCard key={i} rec={r} index={i} update={update} remove={remove} />
        ))}
        <AddButton onClick={() => add("dependent")} label="Add dependent recommender" />
      </div>
    </div>
  );
}

function RecommenderCard({
  rec, index, update, remove,
}: {
  rec: Recommender;
  index: number;
  update: (i: number, f: keyof Recommender, v: string) => void;
  remove: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-surface-muted text-text-secondary capitalize">
          {rec.kind}
        </span>
        <RemoveButton onClick={() => remove(index)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label required>Full name</Label>
          <input className="input text-sm" placeholder="Dr. Jane Smith" value={rec.name} onChange={(e) => update(index, "name", e.target.value)} />
        </div>
        <div>
          <Label required>Title</Label>
          <input className="input text-sm" placeholder="Professor of Computer Science" value={rec.title} onChange={(e) => update(index, "title", e.target.value)} />
        </div>
      </div>
      <div>
        <Label required>Institution</Label>
        <input className="input text-sm" placeholder="MIT" value={rec.institution} onChange={(e) => update(index, "institution", e.target.value)} />
      </div>
      <div>
        <Label hint="Awards, publications, senior positions — why their opinion is authoritative">Key credentials</Label>
        <textarea className="input text-sm" rows={2} value={rec.credentials} onChange={(e) => update(index, "credentials", e.target.value)} />
      </div>
      <div>
        <Label hint={rec.kind === "independent" ? "How do they know your work? (e.g. cited your papers, met at a conference)" : "Nature of working relationship (e.g. PhD advisor for 4 years)"} required>
          Relationship
        </Label>
        <textarea className="input text-sm" rows={2} value={rec.relationship} onChange={(e) => update(index, "relationship", e.target.value)} />
      </div>
      <div>
        <Label optional>Email</Label>
        <input type="email" className="input text-sm" placeholder="jane@university.edu" value={rec.email} onChange={(e) => update(index, "email", e.target.value)} />
      </div>
    </div>
  );
}
