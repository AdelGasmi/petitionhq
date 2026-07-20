"use client";

import { useState } from "react";
import type { DraftingRules, SectionRule } from "@/app/api/attorney-rules/route";

const LETTER_SECTIONS = [
  { id: "opening", label: "Opening paragraph", hint: "How the recommender introduces themselves and the applicant" },
  { id: "qualifications", label: "Qualifications & credentials", hint: "Education, degrees, professional background" },
  { id: "research_merit", label: "Research merit (Prong 1)", hint: "Substantial merit and national importance of the work" },
  { id: "well_positioned", label: "Well positioned (Prong 2)", hint: "Why the applicant is well positioned to advance the endeavor" },
  { id: "waiver_justification", label: "Waiver justification (Prong 3)", hint: "Why waiving the job offer requirement benefits the US" },
  { id: "closing", label: "Closing paragraph", hint: "Strong closing and call to action" },
];

const PETITION_SECTIONS = [
  { id: "intro", label: "Introduction", hint: "Overview of the petitioner and their proposed endeavor" },
  { id: "endeavor", label: "Proposed endeavor", hint: "Detailed description of the work and its significance" },
  { id: "prong1_merit", label: "Prong 1 — Substantial merit", hint: "Why the work has substantial merit" },
  { id: "prong1_importance", label: "Prong 1 — National importance", hint: "Connection to US national interests and federal priorities" },
  { id: "prong2", label: "Prong 2 — Well positioned", hint: "Track record, publications, recognition, plan to continue" },
  { id: "prong3", label: "Prong 3 — Balance of factors", hint: "Why waiving the job offer benefits the US on balance" },
];

const TONE_OPTIONS = [
  "Formal and authoritative",
  "Conversational but professional",
  "Academic and precise",
  "Persuasive and direct",
];

function emptyRule(): SectionRule {
  return { instructions: "", tone: "", mustInclude: [], avoid: [] };
}

function SectionRuleEditor({
  section,
  rule,
  onChange,
}: {
  section: { id: string; label: string; hint: string };
  rule: SectionRule;
  onChange: (r: SectionRule) => void;
}) {
  const [expanded, setExpanded] = useState(!!rule.instructions);

  return (
    <div className="rounded-lg border border-border-default bg-surface-card">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div>
          <p className="text-sm font-medium text-text-primary">{section.label}</p>
          <p className="text-xs text-text-muted">{section.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          {rule.instructions && (
            <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs text-success-text">
              Configured
            </span>
          )}
          <span className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}>
            ▼
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-subtle px-4 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Instructions for this section
            </label>
            <textarea
              className="input text-sm"
              rows={4}
              placeholder="e.g., Always cite specific case numbers when referencing USCIS precedent decisions. Include at least 2 specific publications with citation counts. Emphasize the applicant's unique contributions rather than team work..."
              value={rule.instructions}
              onChange={(e) => onChange({ ...rule, instructions: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tone</label>
            <div className="filter-pill-row">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="filter-pill"
                  aria-pressed={rule.tone === t}
                  onClick={() => onChange({ ...rule, tone: rule.tone === t ? "" : t })}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Must include (one per line)
            </label>
            <textarea
              className="input text-sm"
              rows={3}
              placeholder="e.g., Specific citation counts&#10;Federal program alignment&#10;Letters of support from independent experts"
              value={(rule.mustInclude ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  ...rule,
                  mustInclude: e.target.value.split("\n").filter((l) => l.trim()),
                })
              }
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Avoid (one per line)
            </label>
            <textarea
              className="input text-sm"
              rows={2}
              placeholder="e.g., Vague language like 'numerous' or 'significant'&#10;Generic praise without evidence"
              value={(rule.avoid ?? []).join("\n")}
              onChange={(e) =>
                onChange({
                  ...rule,
                  avoid: e.target.value.split("\n").filter((l) => l.trim()),
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function DraftingRulesEditor({
  initialRules,
  endpoint = "/api/attorney-rules",
}: {
  initialRules: DraftingRules;
  /** Beta self-drafters PUT to /api/profile/drafting-rules instead of the attorney FirmProfile route. */
  endpoint?: string;
}) {
  const [rules, setRules] = useState<DraftingRules>({
    letterSections: initialRules.letterSections ?? {},
    petitionSections: initialRules.petitionSections ?? {},
    globalGuidance: initialRules.globalGuidance ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const updateLetterRule = (sectionId: string, rule: SectionRule) => {
    setRules((r) => ({
      ...r,
      letterSections: { ...r.letterSections, [sectionId]: rule },
    }));
  };

  const updatePetitionRule = (sectionId: string, rule: SectionRule) => {
    setRules((r) => ({
      ...r,
      petitionSections: { ...r.petitionSections, [sectionId]: rule },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error ?? `Save failed (${res.status})`);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      setSaveError("Network error — changes not saved.");
    } finally {
      setSaving(false);
    }
  };

  const configuredCount =
    Object.values(rules.letterSections).filter((r) => r.instructions).length +
    Object.values(rules.petitionSections).filter((r) => r.instructions).length;

  return (
    <div className="space-y-8">
      {/* Global guidance */}
      <div className="card space-y-3">
        <h2 className="font-serif text-lg">Global drafting guidance</h2>
        <p className="text-xs text-text-muted">
          These instructions apply to ALL letters and petition drafts. Use for firm-wide standards, writing style preferences, or compliance requirements.
        </p>
        <textarea
          className="input text-sm"
          rows={5}
          placeholder="e.g., Always use the Dhanasar framework explicitly. Reference Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) in every petition brief. Use active voice. Avoid first-person pronouns in petition briefs. All letters should be 800-1200 words..."
          value={rules.globalGuidance}
          onChange={(e) => setRules((r) => ({ ...r, globalGuidance: e.target.value }))}
        />
      </div>

      {/* Letter sections */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg">Recommendation letter sections</h2>
        <p className="text-xs text-text-muted">
          Define rules for each part of the recommendation letters the AI drafts.
        </p>
        <div className="space-y-2">
          {LETTER_SECTIONS.map((s) => (
            <SectionRuleEditor
              key={s.id}
              section={s}
              rule={rules.letterSections[s.id] ?? emptyRule()}
              onChange={(r) => updateLetterRule(s.id, r)}
            />
          ))}
        </div>
      </div>

      {/* Petition sections */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg">Petition brief sections</h2>
        <p className="text-xs text-text-muted">
          Define rules for each section of the I-140 NIW petition brief.
        </p>
        <div className="space-y-2">
          {PETITION_SECTIONS.map((s) => (
            <SectionRuleEditor
              key={s.id}
              section={s}
              rule={rules.petitionSections[s.id] ?? emptyRule()}
              onChange={(r) => updatePetitionRule(s.id, r)}
            />
          ))}
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 border-t border-border-default bg-surface-card/90 backdrop-blur px-4 py-4 flex items-center justify-between gap-4">
        <p className="text-xs text-text-muted">
          {configuredCount} section{configuredCount !== 1 ? "s" : ""} configured — rules will apply to your next draft.
        </p>
        <div className="flex items-center gap-3">
          {saveError && (
            <span className="text-xs text-danger-text">{saveError}</span>
          )}
          <button
            type="button"
            className="btn btn-primary text-sm px-6"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving..." : saved ? "Saved ✓" : "Save rules"}
          </button>
        </div>
      </div>
    </div>
  );
}
