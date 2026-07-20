// M0 exists in the DB enum for legacy rows but is no longer assigned — new leads start at M1
export type LeadMaturity = "M0" | "M1" | "M2" | "M3" | "M4" | "M5" | "M6" | "M7";

const LEGAL_TRANSITIONS: Record<LeadMaturity, LeadMaturity[]> = {
  M0: ["M1"],
  M1: ["M2"],
  M2: ["M3"],
  M3: ["M4", "M7"], // M7 direct path: deep intake + consent + trust ≥ 60 (no post-claim dossier needed)
  M4: ["M5", "M7"],
  M5: ["M6", "M7"],
  M6: ["M7"],
  M7: [],
};

export function canTransition(from: LeadMaturity, to: LeadMaturity): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

const TRIGGER_MAP: Record<string, LeadMaturity> = {
  light_wizard_complete: "M1",
  deep_wizard_complete: "M2",
  consent_given: "M3",
  dossier_complete: "M4",
  verification_complete: "M7",
  layer2_complete: "M5",
  layer3_complete: "M6",
};

export function nextMaturity(
  current: LeadMaturity,
  trigger: string,
): LeadMaturity | null {
  const target = TRIGGER_MAP[trigger];
  if (!target) return null;
  if (!canTransition(current, target)) return null;
  return target;
}

// ── M7 (attorney-ready) gate ──────────────────────────────────────────
// Minimum trust score for a lead to be marketplace-visible. Mirrors the
// Contract: M7 = M4 + trustScore >= 60.
export const M7_TRUST_THRESHOLD = 60;

// Deep-intake evidence keys — written only by the DEEP wizard (`EMPTY_DEEP`
// in app/check/page.tsx). A light-only lead (saved with just the 5-question
// answers) has none of these, which is exactly how a half-baked lead used to
// reach the attorney marketplace showing only a bare Profile Snapshot.
const DEEP_INTAKE_KEYS = [
  "patents",
  "awards",
  "grants",
  "peerReview",
  "invitedTalks",
  "nationalConnection",
  "usPlan",
  "employerSituation",
] as const;

/**
 * True when the applicant genuinely completed the deep assessment intake —
 * i.e. at least one deep-evidence field is present and answered (including a
 * deliberate "None"). Used to gate marketplace visibility (M7) so a lead whose
 * deep step was never completed or silently dropped never reaches attorneys.
 */
export function hasCompletedDeepIntake(
  formData: Record<string, unknown> | null | undefined,
): boolean {
  if (!formData) return false;
  return DEEP_INTAKE_KEYS.some((k) => {
    const v = formData[k];
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
}
