/**
 * Neutral evidence ledger — voice-agnostic third-person fact sheet.
 *
 * One Haiku pass converts raw formData evidence (which often contains
 * first-person intake data like "I published…") into a neutral ledger like
 * "The applicant published X in Venue (2021), 142 citations." This ledger is
 * injected into every section and letter draft so the model always cites facts
 * consistently and never confuses the applicant's voice with the drafter's.
 *
 * Caching strategy: stored on formData.evidenceLedger.{hash}. The hash is
 * derived from the evidence atoms + endeavor statement so any intake edit
 * automatically invalidates and triggers a fresh generation.
 */

import { completeStructured } from "./lmstudio";
import { extractEvidence } from "./drafting";
import { sha256Hex } from "./sha256";

export type EvidenceLedger = {
  /** Short hash of the source data — used for cache invalidation */
  hash: string;
  /** ISO timestamp */
  generatedAt: string;
  /** Neutral, third-person fact sentences, one per evidence atom */
  facts: string[];
  /** Prose summary suitable for direct injection into prompts */
  prose: string;
};

/** Derive a stable fingerprint of the inputs that affect the ledger. */
export function ledgerHash(formData: Record<string, unknown>): string {
  const q = JSON.stringify(formData.qualifications ?? {});
  const e = JSON.stringify(formData.endeavor ?? {});
  return sha256Hex(`${q}|${e}`).slice(0, 16);
}

/**
 * Return the cached ledger if the hash still matches, otherwise return null
 * so the caller knows to regenerate.
 */
export function getCachedLedger(
  formData: Record<string, unknown>
): EvidenceLedger | null {
  const stored = (formData.evidenceLedger ?? null) as EvidenceLedger | null;
  if (!stored) return null;
  const current = ledgerHash(formData);
  return stored.hash === current ? stored : null;
}

/**
 * Generate a fresh neutral evidence ledger via a single fast (Haiku) call.
 * Returns the ledger; caller is responsible for persisting it to formData.
 */
export async function generateEvidenceLedger(
  formData: Record<string, unknown>
): Promise<EvidenceLedger> {
  const atoms = extractEvidence(formData);
  const endeavor = (formData.endeavor ?? {}) as Record<string, unknown>;
  const petitionerInfo = (formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const fullName =
    petitionerInfo.fullName
      ? String(petitionerInfo.fullName)
      : [petitionerInfo.givenName, petitionerInfo.middleName, petitionerInfo.familyName]
          .filter(Boolean)
          .join(" ") || "The applicant";

  const atomList = atoms.length
    ? atoms
        .map(
          (a, i) =>
            `${i + 1}. [${a.kind}] ${a.summary}${a.metric ? ` (${a.metric})` : ""}${a.year ? `, ${a.year}` : ""}${a.detail ? ` — ${a.detail}` : ""}`
        )
        .join("\n")
    : "(no structured evidence — use general statements only)";

  type LedgerOutput = { facts: string[]; prose: string };

  const result = await completeStructured<LedgerOutput>(
    [
      {
        role: "system",
        content: `You convert raw immigration evidence atoms into a neutral, third-person fact ledger.

Rules:
- Write in third person only: "The applicant", "Dr. ${fullName.split(" ").pop() ?? "Smith"}", never "I" or "my"
- Be precise: preserve all numbers, dates, journal names, award names exactly
- No evaluation language ("impressive", "significant") — facts only
- Each fact = one sentence
- The prose block = a 150-word paragraph summarising all facts for direct injection into a legal brief

Return ONLY valid JSON: {"facts": ["sentence 1", "sentence 2", ...], "prose": "paragraph"}`,
      },
      {
        role: "user",
        content: `Applicant: ${fullName}
Field: ${String(endeavor.endeavorField ?? "not specified")}
Endeavor: ${String(endeavor.endeavorStatement ?? "not specified")}

Evidence atoms:
${atomList}`,
      },
    ],
    { tier: "fast", temperature: 0, maxTokens: 1500, usageContext: { route: "evidence-ledger" } }
  );

  const hash = ledgerHash(formData);
  return {
    hash,
    generatedAt: new Date().toISOString(),
    facts: result.facts ?? [],
    prose: result.prose ?? "",
  };
}

/**
 * Get the cached ledger or generate a fresh one.
 * Does NOT persist — callers must write back via patchFormData.
 */
export async function getOrGenerateLedger(
  formData: Record<string, unknown>
): Promise<EvidenceLedger> {
  return getCachedLedger(formData) ?? generateEvidenceLedger(formData);
}
