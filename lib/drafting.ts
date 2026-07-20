/**
 * Letter drafting pipeline.
 *
 * draft -> critique -> optionally regenerate weak paragraphs.
 * The critique pass is what separates this from a one-shot prompt.
 */

import { complete, completeStructured, type LlmOptions } from "./lmstudio";
import { bannedWordsBlock, CRITIQUE_SYSTEM, critiqueUser } from "./prompts/constants";
import type { LetterRequirement } from "@/forms/types";
import type { QualityReport } from "./db";
import type { ClaimLedger } from "./claimLedger";
import { sha256Hex } from "./sha256";

export type EvidenceAtom = {
  id: string;
  kind: "publication" | "award" | "grant" | "patent" | "media" | "talk" | "role" | "project";
  summary: string;
  detail?: string;
  year?: number;
  metric?: string;
};

export type ApplicantProfile = {
  name: string;
  field: string;
  endeavor: string;
  highlightedEvidence: EvidenceAtom[];
  // Sprint 6 enrichment atoms — passed from formData
  nstcCategories?: string[];
  federalPrograms?: Array<{ programName: string; agencyOrOffice?: string; specificGoal?: string }>;
  notableCitations?: Array<{ citingAuthor?: string; citingJournal?: string; citingYear?: number; howUsed?: string }>;
  researchIsPublished?: boolean;
};

export type RecommenderProfile = {
  name: string;
  title: string;
  institution: string;
  credentials?: string;
  relationship?: string;
  kind?: "independent" | "dependent" | "academic" | "governmental";
};

export type DraftRequest = {
  letter: LetterRequirement;
  applicant: ApplicantProfile;
  recommender: RecommenderProfile;
  additionalGuidance?: string;
  /** Full text of the per-form guide MD — injected into the system prompt. */
  formGuide?: string;
  /** LLM options for the main drafting pass. */
  llm?: LlmOptions;
  /** LLM options for the critique pass (often a smaller/faster model). */
  critiqueLlm?: LlmOptions;
};

export type DraftResult = {
  content: string;
  wordCount: number;
  qualityReport: QualityReport;
};

// ---------------------------------------------------------------------------
// Evidence extraction — shared across API routes and client components
// ---------------------------------------------------------------------------

/**
 * Build an atom with a CONTENT-DERIVED id.
 *
 * The id is a hash of the atom's semantic fields, NOT its array position. This
 * is load-bearing for the claim-curation gate: an attorney approves atom IDs,
 * and those approvals must survive the applicant reordering/adding entries
 * during later intake. A positional id (`pub-${i}`) would silently re-point an
 * approval at a different claim the moment the array shifts.
 *
 * Hash input is a delimited fingerprint of (kind, summary, detail, year,
 * metric). The "sha256:" prefix namespaces the id and leaves room for future
 * id schemes. Truncated to 16 hex chars (64 bits) — ample collision resistance
 * for the handful of atoms in a single case, while keeping IDs readable.
 */
export function makeAtom(a: Omit<EvidenceAtom, "id">): EvidenceAtom {
  const fingerprint = `${a.kind}|${a.summary}|${a.detail ?? ""}|${a.year ?? ""}|${a.metric ?? ""}`;
  return { id: `sha256:${sha256Hex(fingerprint).slice(0, 16)}`, ...a };
}

/**
 * Pull all evidence atoms from a case's formData.
 * Reads from the `qualifications` section (NIW) — covers all 8 atom kinds.
 * Safe to call on any form; returns [] if section doesn't exist.
 */
export function extractEvidence(formData: Record<string, unknown>): EvidenceAtom[] {
  const atoms: EvidenceAtom[] = [];
  const q = (formData.qualifications ?? {}) as Record<string, unknown>;

  // Publications — include Sprint 6 enrichment fields when present
  const pubs = (q.publications ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < pubs.length; i++) {
    const p = pubs[i];
    if (!p.title) continue;
    const detailParts = [
      p.venue ? `Published in ${p.venue}` : null,
      typeof p.impactFactor === "number" ? `IF=${p.impactFactor}` : null,
      p.journalRank ? String(p.journalRank) : null,
      p.citationPercentile ? `ESI: ${p.citationPercentile}` : null,
      typeof p.esiFieldAverage === "number" ? `field avg ${p.esiFieldAverage}` : null,
    ].filter(Boolean);
    atoms.push(makeAtom({
      kind: "publication",
      summary: String(p.title),
      detail: detailParts.length ? detailParts.join(" | ") : undefined,
      year: typeof p.year === "number" ? p.year : undefined,
      metric: typeof p.citations === "number" ? `${p.citations} citations` : undefined,
    }));
  }

  // Awards
  const awards = (q.awards ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < awards.length; i++) {
    const a = awards[i];
    if (!a.name) continue;
    atoms.push(makeAtom({
      kind: "award",
      summary: String(a.name),
      detail: a.significance ? String(a.significance) : undefined,
      year: typeof a.year === "number" ? a.year : undefined,
    }));
  }

  // Grants
  const grants = (q.grants ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < grants.length; i++) {
    const g = grants[i];
    if (!g.title) continue;
    const parts = [g.agency, g.amount].filter(Boolean);
    atoms.push(makeAtom({
      kind: "grant",
      summary: String(g.title),
      detail: parts.length ? parts.join(" · ") : undefined,
      year: typeof g.year === "number" ? g.year : undefined,
      metric: g.role ? String(g.role) : undefined,
    }));
  }

  // Patents
  const patents = (q.patents ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < patents.length; i++) {
    const p = patents[i];
    if (!p.title) continue;
    atoms.push(makeAtom({
      kind: "patent",
      summary: String(p.title),
      detail: p.number ? `Patent ${p.number}` : undefined,
      year: typeof p.year === "number" ? p.year : undefined,
      metric: p.status ? String(p.status) : undefined,
    }));
  }

  // Media coverage
  const media = (q.mediaCoverage ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < media.length; i++) {
    const m = media[i];
    if (!m.outlet) continue;
    atoms.push(makeAtom({
      kind: "media",
      summary: m.title ? `${m.outlet}: ${m.title}` : String(m.outlet),
      detail: m.reach ? String(m.reach) : undefined,
      year: typeof m.year === "number" ? m.year : undefined,
    }));
  }

  // Invited talks
  const talks = (q.invitedTalks ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < talks.length; i++) {
    const t = talks[i];
    if (!t.title) continue;
    atoms.push(makeAtom({
      kind: "talk",
      summary: String(t.title),
      detail: t.venue ? String(t.venue) : undefined,
      year: typeof t.year === "number" ? t.year : undefined,
      metric: t.kind ? String(t.kind) : undefined,
    }));
  }

  // Editorial / peer review roles
  const roles = (q.editorialRoles ?? []) as Array<Record<string, unknown>>;
  for (let i = 0; i < roles.length; i++) {
    const r = roles[i];
    if (!r.journal) continue;
    atoms.push(makeAtom({
      kind: "role",
      summary: String(r.journal),
      detail: r.role ? String(r.role) : undefined,
      year: typeof r.year === "number" ? r.year : undefined,
    }));
  }

  return atoms;
}

/**
 * The `qualifications` arrays that extractEvidence turns into atoms. Each entry
 * maps to exactly one atom (or none, when its key field is missing).
 */
const LEDGER_GOVERNED_CATEGORIES = [
  "publications",
  "awards",
  "grants",
  "patents",
  "mediaCoverage",
  "invitedTalks",
  "editorialRoles",
] as const;

/**
 * Project formData down to ONLY the attorney-approved claims.
 *
 * The claim ledger approves atom IDs. `applyClaimLedger` filters the atom stream
 * that drives the generated PROSE — but the exhibit plan, citation totals, and
 * the PDF profile summary all read the raw `qualifications` arrays and would
 * otherwise aggregate EXCLUDED claims (e.g. an unapproved paper still inflating
 * the citation count and venue list). That silently breaks the gate's "built
 * solely from approved claims" guarantee. This rebuilds `qualifications` so
 * every downstream consumer of formData sees exactly the approved set.
 *
 *   ledger null / no approved[]  → formData unchanged (un-curated ⇒ all allowed)
 *   ledger present               → each governed array keeps only entries whose
 *                                   computed atom id ∈ approved[]
 *
 * Entry→id is recomputed by re-running extractEvidence on the single entry, so
 * the hashing is never duplicated and always matches what the gate approved.
 */
export function filterFormDataByLedger(
  formData: Record<string, unknown>,
  ledger: ClaimLedger | null | undefined,
): Record<string, unknown> {
  // Mirror applyClaimLedger's contract: a genuinely absent ledger means
  // un-curated ⇒ everything allowed. Never treat that as "approve nothing".
  if (!ledger || !Array.isArray(ledger.approved)) return formData;
  const approved = new Set(ledger.approved);

  const q = (formData.qualifications ?? {}) as Record<string, unknown>;
  const curatedQ: Record<string, unknown> = { ...q };

  for (const cat of LEDGER_GOVERNED_CATEGORIES) {
    const arr = q[cat];
    if (!Array.isArray(arr)) continue;
    curatedQ[cat] = (arr as Array<Record<string, unknown>>).filter((entry) => {
      const atoms = extractEvidence({ qualifications: { [cat]: [entry] } });
      // No atom ⇒ not an approvable claim (e.g. a publication with no title);
      // drop it so it can't inflate aggregate counts beyond the approved set.
      return atoms.length > 0 && atoms.every((a) => approved.has(a.id));
    });
  }

  return { ...formData, qualifications: curatedQ };
}

const FALLBACK_QUALITY_REPORT: QualityReport = {
  overallScore: 0,
  dimensions: {
    specificity: { score: 0, notes: "Critique unavailable — model returned non-JSON output." },
    evidentiarySupport: { score: 0, notes: "" },
    voiceAuthenticity: { score: 0, notes: "" },
    frameworkCoverage: { score: 0, notes: "" },
    aiSlopFreeness: { score: 0, notes: "" },
  },
  weakParagraphs: [],
  strengths: [],
  readyToSend: false,
};

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function draftLetter(req: DraftRequest): Promise<DraftResult> {
  const content = await generateInitialDraft(req);
  // Critique is best-effort: if the model can't produce valid JSON, we still
  // return the draft with a fallback report rather than failing the whole call.
  let qualityReport: QualityReport;
  try {
    qualityReport = await critique(content, req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    qualityReport = {
      ...FALLBACK_QUALITY_REPORT,
      dimensions: {
        ...FALLBACK_QUALITY_REPORT.dimensions,
        specificity: {
          score: 0,
          notes: `Critique failed: ${msg.slice(0, 200)}`,
        },
      },
    };
  }
  return {
    content,
    wordCount: content.split(/\s+/).filter(Boolean).length,
    qualityReport,
  };
}

export async function regenerateSection(
  originalLetter: string,
  sectionToFix: string,
  issue: string,
  req: DraftRequest
): Promise<string> {
  // systemPrompt(req) already carries attorney firm rules (T4), so the rewrite
  // honors them without repeating the block in the user turn.
  const system = systemPrompt(req);
  const userPrompt = `
Here is the full letter:

<letter>
${originalLetter}
</letter>

This paragraph has a quality issue: "${issue}"

<paragraph>
${sectionToFix}
</paragraph>

Rewrite ONLY this paragraph to fix the issue. Keep the tone and voice consistent with the rest of the letter. Return only the rewritten paragraph — no explanation, no headers.
  `.trim();

  return complete(
    [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    req.llm
  );
}

// ---------------------------------------------------------------------------
// Initial draft
// ---------------------------------------------------------------------------

/** Build the [system, user] messages for the initial draft — used by both
 *  the blocking and streaming draft paths. */
export function buildDraftMessages(req: DraftRequest): [import("./lmstudio").LlmMessage, import("./lmstudio").LlmMessage] {
  return [
    { role: "system", content: systemPrompt(req) },
    { role: "user",   content: draftingPrompt(req) },
  ];
}

async function generateInitialDraft(req: DraftRequest): Promise<string> {
  const system = systemPrompt(req);
  const user = draftingPrompt(req);

  // Petition letters need 5000–11000 tokens. Recommendation letters fit in 2000.
  const defaultMax = req.letter.kind === "petition-letter" ? 8192 : 3500;

  return complete(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { temperature: 0.7, maxTokens: defaultMax, ...req.llm }
  );
}

function systemPrompt(req: DraftRequest): string {
  const { letter, recommender, formGuide, additionalGuidance } = req;
  const framework = letter.draftingHints?.framework
    ? `This letter must map to the ${letter.draftingHints.framework} framework.`
    : "";

  const guideSection = formGuide
    ? `\n\n---\nFORM-SPECIFIC GUIDE (follow these instructions carefully):\n\n${formGuide}\n---`
    : "";

  // Attorney firm rules are durable behavioral instructions, so they belong in
  // the system prompt (right after the form guide) — not trailing in the user
  // turn as context. The banned-words / output-format constraints still bracket
  // generation.
  const attorneySection = additionalGuidance
    ? `\n\n---\nATTORNEY FIRM RULES (apply throughout):\n\n${additionalGuidance}\n---`
    : "";

  const isPetitionLetter = letter.kind === "petition-letter";

  return `
You are a senior immigration attorney who has drafted thousands of ${isPetitionLetter ? "NIW petition briefs and legal documents" : "recommendation letters"} for USCIS petitions. You draft letters that:

- Use SPECIFIC, concrete facts — never vague generalities. Cite specific papers by topic, dates, numbers, projects. "Dr. Rao's 2021 paper on defect detection demonstrated a 40% reduction in false positives" not "Dr. Rao's work is impactful."
- Vary sentence length deliberately. Short sentences. Then longer sentences with subordinate clauses that develop an idea. Mix them.
- Cite specific publications, projects, dates, numbers, and outcomes wherever possible.
- Never invent facts. If a claim needs support, it must be derivable from the evidence provided.

${framework}${guideSection}${attorneySection}

${isPetitionLetter
    ? "This is the NIW petition brief — a formal legal argument written in the petitioner's own voice. It must address all three Dhanasar prongs with specificity and depth."
    : `This is a ${letter.kind} letter. The recommender is ${recommender.kind === "independent"
        ? "INDEPENDENT — they know the applicant only through reputation, publications, or public work. They must establish how they became aware of the applicant's work."
        : "DEPENDENT — they have worked with the applicant directly and can speak to specific projects and interactions."}`}

Output ONLY the letter body. No headers, no date line, no signature — the platform adds those. Start with the opening paragraph directly.
  `.trim();
}

function draftingPrompt(req: DraftRequest): string {
  // additionalGuidance (attorney firm rules) is injected via systemPrompt (T4),
  // not here in the user turn.
  const { letter, applicant, recommender } = req;
  const hints = letter.draftingHints;

  const evidenceList = applicant.highlightedEvidence.length
    ? applicant.highlightedEvidence
        .map((e, i) =>
          `${i + 1}. [${e.kind}] ${e.summary}${e.metric ? ` (${e.metric})` : ""}${e.year ? `, ${e.year}` : ""}${e.detail ? `\n   Context: ${e.detail}` : ""}`
        )
        .join("\n")
    : "(no evidence atoms provided — draft carefully and note where specificity is missing)";

  const mustAddress = hints?.mustAddress
    ? `\nThe letter must address each of the following:\n${hints.mustAddress.map((p) => `- ${p}`).join("\n")}`
    : "";

  const targetLen = hints?.targetLength
    ? `\nTarget length: ${hints.targetLength.minWords}-${hints.targetLength.maxWords} words.`
    : "";

  const isPetition = letter.kind === "petition-letter";
  const isGovernmental = recommender.kind === "governmental";

  const recommenderBlock = isPetition
    ? ""
    : `RECOMMENDER
Name: ${recommender.name}
Title: ${recommender.title}
Institution: ${recommender.institution}
Credentials: ${recommender.credentials ?? "Not provided"}
Relationship to applicant: ${recommender.relationship ?? "Not provided"}

`;

  // Sprint 6 enrichment block — only built when data is present
  const enrichmentLines: string[] = [];

  if (applicant.notableCitations?.length) {
    const lines = applicant.notableCitations
      .filter(c => c.citingAuthor || c.citingJournal)
      .map(c => `  - ${c.citingAuthor ?? ""}${c.citingYear ? ` (${c.citingYear})` : ""}${c.citingJournal ? `, ${c.citingJournal}` : ""}${c.howUsed ? `: ${c.howUsed}` : ""}`)
      .join("\n");
    if (lines) enrichmentLines.push(`NOTABLE_CITATIONS:\n${lines}`);
  }

  if (applicant.nstcCategories?.length) {
    enrichmentLines.push(`NSTC_CATEGORIES: ${applicant.nstcCategories.join(", ")}`);
  }

  if ((isGovernmental || isPetition) && applicant.federalPrograms?.length) {
    const lines = applicant.federalPrograms
      .filter(p => p.programName)
      .map(p => `  - ${p.programName}${p.agencyOrOffice ? ` — ${p.agencyOrOffice}` : ""}${p.specificGoal ? ` (goal: ${p.specificGoal})` : ""}`)
      .join("\n");
    if (lines) enrichmentLines.push(`FEDERAL_PROGRAMS:\n${lines}`);
  }

  if (applicant.researchIsPublished !== false && !isPetition) {
    enrichmentLines.push(`BROAD_DISSEMINATION: true — research is published openly in peer-reviewed journals, not proprietary to one employer`);
  }

  const enrichmentBlock = enrichmentLines.length
    ? `\nENRICHED CONTEXT (use these facts precisely in the argument):\n${enrichmentLines.join("\n")}\n`
    : "";

  return `
${recommenderBlock}APPLICANT / PETITIONER
Name: ${applicant.name}
Field: ${applicant.field}
Proposed endeavor: ${applicant.endeavor}

EVIDENCE (use all facts to build the argument):
${evidenceList}
${enrichmentBlock}
${mustAddress}${targetLen}

${bannedWordsBlock()}

Draft the letter now.
  `.trim();
}

// ---------------------------------------------------------------------------
// Critique
// ---------------------------------------------------------------------------

async function critique(letter: string, req: DraftRequest): Promise<QualityReport> {
  const mustAddress = req.letter.draftingHints?.mustAddress ?? [];

  const system = CRITIQUE_SYSTEM;
  const user = critiqueUser(letter, mustAddress);

  // Prefer an explicit critique model (the user's "fast" pick); otherwise fall
  // back to the drafting opts but mark this as the fast tier.
  const opts: LlmOptions = req.critiqueLlm
    ? { temperature: 0.2, maxTokens: 2000, tier: "fast", ...req.critiqueLlm }
    : { temperature: 0.2, maxTokens: 2000, tier: "fast", ...req.llm, model: undefined };

  return completeStructured<QualityReport>(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    opts
  );
}
