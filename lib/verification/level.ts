/**
 * Verification level — the single honest summary of how strongly the
 * applicant's identity has been established.
 *
 * TRU-1: replaces the legacy binary "Verified" / "Self-reported" with a
 * three-tier model that surfaces the OAuth / corroboration distinction.
 */

import type { AnchorConfidence, AnchorBasis } from "./identity";

export type VerificationLevel =
  | "identity_confirmed"     // ORCID OAuth — applicant proved account ownership
  | "publicly_corroborated"  // high or medium anchor, no OAuth
  | "self_reported";         // low or none — no independent corroboration

/**
 * Derive the verification level from identity reconciliation output.
 * Only `orcid_oauth` yields "identity_confirmed" — a name+institution match,
 * however confident, is only corroboration, not ownership proof.
 */
export function deriveVerificationLevel(
  anchor: AnchorConfidence,
  basis: AnchorBasis,
): VerificationLevel {
  if (basis === "orcid_oauth") return "identity_confirmed";
  if (anchor === "high" || anchor === "medium") return "publicly_corroborated";
  return "self_reported";
}

export const LEVEL_LABEL: Record<VerificationLevel, string> = {
  identity_confirmed: "Identity confirmed (ORCID)",
  publicly_corroborated: "Publicly corroborated",
  self_reported: "Self-reported",
};
