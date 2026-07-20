/**
 * Fork-C — atom ↔ verifiedClaim display map (pre-launch.md §4.3).
 *
 * Atom IDs (content hashes) and `verifiedClaims` keys do NOT share a key space,
 * so the curation gate's "Verified" badge maps by atom KIND: an atom shows
 * "Verified" iff ANY of its kind's mapped verifiedClaims entries has
 * status === "verified". This is DISPLAY-ONLY — it informs the attorney but
 * never decides approval and persists no new state.
 */

import type { EvidenceAtom } from "./drafting";

type AtomKind = EvidenceAtom["kind"];

/** Which verifiedClaims keys count as corroboration for each atom kind. */
const KIND_TO_CLAIM_KEYS: Record<AtomKind, string[]> = {
  publication: [
    "publications",
    "researcher_profile",
    "semantic_scholar",
    "dblp_publications",
    "pubmed_publications",
    "arxiv_preprints",
  ],
  grant: ["nsf_grants", "nih_grants"],
  patent: ["patents"],
  award: ["awards"],
  talk: ["invitedTalks"],
  role: ["peerReview"],
  // No public source maps cleanly to these — always "Self-reported".
  media: [],
  project: [],
};

type ClaimStatus = { status?: string };

/**
 * True iff the atom's kind has at least one corroborating verifiedClaim with
 * status "verified". `media`/`project` always return false (self-reported).
 */
export function isAtomKindVerified(
  kind: AtomKind,
  verifiedClaims: Record<string, ClaimStatus> | null | undefined,
): boolean {
  if (!verifiedClaims) return false;
  const keys = KIND_TO_CLAIM_KEYS[kind] ?? [];
  return keys.some((k) => verifiedClaims[k]?.status === "verified");
}
