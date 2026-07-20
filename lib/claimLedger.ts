/**
 * Claim ledger — the attorney curation gate's source of truth.
 *
 * Stored on `Case.claimLedger` (nullable JSON). It records WHICH evidence atoms
 * the claiming attorney has explicitly approved for use in the generated
 * dossier/brief prose. The dossier generator intercepts the atom stream and,
 * when a ledger is present, keeps only approved atom IDs.
 *
 * ── Timing contract (critical, do not "optimise" away) ──────────────────────
 * Lead conversion (autoConvertLead) creates the Case BEFORE intake collects the
 * full qualifications. So at convert time there are few/no atoms yet. We
 * therefore leave claimLedger NULL at convert. The interceptor treats
 *   ledger === null  →  ALL atoms allowed (safe default)
 * Pre-seeding `approved: []` at convert would be catastrophic: every atom added
 * during later intake would be silently excluded from the prose. The gate UI is
 * the ONLY place that writes a ledger, and it seeds the approve-list from the
 * LIVE atoms present at curation time.
 *
 * `approved` / `excluded` hold atom IDs (content hashes, "sha256:…"). An atom
 * not present in either list is treated as un-curated; the interceptor's rule
 * is strictly "approved-only", so absence ⇒ excluded once a ledger exists.
 */

import type { EvidenceAtom } from "./drafting";
import { sha256Hex } from "./sha256";

export type ClaimLedger = {
  /** Atom IDs the attorney confirmed for use in generated prose. */
  approved: string[];
  /** Atom IDs the attorney explicitly rejected (audit trail; not used in prose). */
  excluded: string[];
  /** User ID of the attorney who signed the attestation, if attested. */
  attestedBy?: string;
  /** ISO-8601 timestamp of attestation. */
  attestedAt?: string;
  /** sha256(approved.sort().join(",")) — tamper-evident root over the approve set. */
  ledgerRoot?: string;
};

/**
 * Narrow an arbitrary JSON value (Prisma `Json?`) into a ClaimLedger, or null.
 * Returns null for null/undefined/malformed input so callers can rely on the
 * "null ⇒ all atoms allowed" interceptor contract.
 */
export function asClaimLedger(value: unknown): ClaimLedger | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.approved)) return null;
  return {
    approved: v.approved.filter((x): x is string => typeof x === "string"),
    excluded: Array.isArray(v.excluded)
      ? v.excluded.filter((x): x is string => typeof x === "string")
      : [],
    attestedBy: typeof v.attestedBy === "string" ? v.attestedBy : undefined,
    attestedAt: typeof v.attestedAt === "string" ? v.attestedAt : undefined,
    ledgerRoot: typeof v.ledgerRoot === "string" ? v.ledgerRoot : undefined,
  };
}

/**
 * Filter an extracted atom set down to what the attorney approved.
 *
 *   ledger null / undefined / no approved[]  → ALL atoms (un-curated default)
 *   ledger present                            → only atoms whose id ∈ approved[]
 *
 * CRITICAL: never fall back to "all atoms" when a ledger IS present but
 * `approved` is empty. A present ledger with `approved: []` means the attorney
 * excluded everything and MUST yield zero atoms — `?? allAtoms` here would be a
 * silent placebo that re-admits rejected claims. The only "all atoms" path is a
 * genuinely absent ledger (null), which the timing contract guarantees at
 * convert and until the gate UI first writes a ledger.
 */
export function applyClaimLedger(
  atoms: EvidenceAtom[],
  ledger: ClaimLedger | null | undefined,
): EvidenceAtom[] {
  if (!ledger || !Array.isArray(ledger.approved)) return atoms;
  const approved = new Set(ledger.approved);
  return atoms.filter((a) => approved.has(a.id));
}

/**
 * Tamper-evident root over the approved set: sha256 of the SORTED, comma-joined
 * atom IDs. Order-independent (the attorney's approve set is a set, not a list),
 * so re-attesting the same claims yields the same root. Stamped into the dossier
 * footer and the ActivityLog attestation as the malpractice-defense artifact.
 */
export function computeLedgerRoot(approved: string[]): string {
  return sha256Hex([...approved].sort().join(","));
}
