import { complete, completeStructured } from "./lmstudio";

export type GroundingFlag = {
  text: string;       // the specific phrase that couldn't be verified
  reason: string;     // e.g. "Paper not in qualifications.publications"
  severity: "error" | "warning";
  /** Character offset of the first occurrence of `text` in the draft. */
  start?: number;
  /** Character offset of the end of the first occurrence of `text` in the draft. */
  end?: number;
};

/**
 * Resolve character offsets for each flag by searching the draft text.
 * Call after runGroundingCheck to make flags jump-able without client-side
 * indexOf calls on ephemeral state.
 */
export function resolveOffsets(flags: GroundingFlag[], draft: string): GroundingFlag[] {
  return flags.map(f => {
    if (f.start !== undefined) return f; // already resolved
    const idx = draft.indexOf(f.text);
    if (idx === -1) return f;
    return { ...f, start: idx, end: idx + f.text.length };
  });
}

export type BriefQualityReport = {
  flags: {
    substantialMerit: GroundingFlag[];
    nationalImportance: GroundingFlag[];
    waiverJustification: GroundingFlag[];
  };
  partnerCredibilityScore: number;
  credibilityNotes: string;
};

type CaseQualifications = {
  publications?: Array<{ title?: string; venue?: string; citations?: number; impactFactor?: number }>;
  awards?: Array<{ name?: string; issuer?: string }>;
  grants?: Array<{ title?: string; funder?: string; amount?: number }>;
  editorialRoles?: Array<{ journal?: string; venue?: string }>;
  [key: string]: unknown;
};

type CaseEndeavor = {
  endeavorField?: string;
  nstcCategories?: string[];
  federalPrograms?: Array<{ programName?: string; agencyOrOffice?: string }>;
  endeavorStatement?: string;
  [key: string]: unknown;
};

type RecommenderRecord = {
  name?: string;
  title?: string;
  institution?: string;
  department?: string;
  [key: string]: unknown;
};

export type GroundingDocument = {
  /** requirementId or display label (e.g. "cv", "personal_statement") */
  name?: string;
  /** Raw text content — truncated before being sent to the LLM */
  content: string;
};

export type GroundingContext = {
  qualifications?: CaseQualifications;
  endeavor?: CaseEndeavor;
  recommenders?: RecommenderRecord[];
  /** Uploaded / pasted document text (CV, personal statement, etc.) */
  documents?: GroundingDocument[];
};

const SYSTEM_PROMPT = `You are a citation auditor reviewing an immigration petition draft.

You will be given:
1. DRAFT — a generated legal brief section
2. EVIDENCE — the applicant's structured verified evidence record
3. DOCUMENTS — optional raw text from uploaded applicant documents (CV, personal statement, etc.)

Your ONLY task: identify any specific claim in DRAFT (paper title, author name, journal name, citation count, impact factor, award name, grant amount, funder name, NSTC category, federal agency name) that is NOT supported by EVIDENCE or DOCUMENTS.

Rules:
- Only flag claims that reference specific numbers, titles, or named entities
- Do NOT flag general statements about the field or national importance
- Do NOT rewrite or suggest improvements
- NSTC categories, federal programs, and agency names present in EVIDENCE.ENDEAVOR are valid — do not flag them
- Recommender names, titles, and institutions present in EVIDENCE.RECOMMENDERS are valid — do not flag them
- Claims supported by DOCUMENTS (raw applicant text) are valid — do not flag them
- Minor article/preposition differences ("Journal of X" vs "The Journal of X") are NOT hallucinations — do not flag them
- If a claim uses approximate language ("approximately", "about") that is close to the evidence, do NOT flag it

Output ONLY valid JSON in this exact format:
{"flags": [{"text": "...", "reason": "...", "severity": "error"|"warning"}]}

If everything is grounded, output: {"flags": []}`;

/**
 * Deterministic pre-pass: extract specific numeric and named claims from the
 * draft and check them against the evidence. Zero LLM cost; survives outages.
 *
 * Checks:
 * 1. Citation counts ("X citations") — must match per-pub counts or their sum ±5%
 * 2. Publication counts ("N publications/papers") — must match pub count ±1
 * 3. Grant amounts ("$X") — must match a known grant amount within 2%
 * 4. Award/prize names — substring match against known awards
 * 5. Recommender names ("Dr./Prof. Lastname") — must be in recommenders list
 */
export function runDeterministicPrePass(draft: string, context: GroundingContext): GroundingFlag[] {
  const flags: GroundingFlag[] = [];
  const q = context.qualifications ?? {};

  // ── 1. Citation counts ────────────────────────────────────────────────────
  const pubs = (q.publications ?? []) as Array<{ citations?: number }>;
  const allCitationCounts = pubs
    .map(p => p.citations)
    .filter((c): c is number => typeof c === "number");

  if (allCitationCounts.length > 0) {
    const total = allCitationCounts.reduce((a, b) => a + b, 0);
    const validCounts = new Set([...allCitationCounts, total]);
    for (const match of draft.matchAll(/\b(\d[\d,]+)\s+citations?/gi)) {
      const n = parseInt(match[1].replace(/,/g, ""), 10);
      if (!isNaN(n)) {
        const isApprox = [...validCounts].some(v => Math.abs(v - n) / Math.max(v, 1) <= 0.05);
        if (!isApprox) {
          flags.push({
            text: match[0],
            reason: `Citation count ${n} not in evidence (per-pub: ${allCitationCounts.join(", ")}; total: ${total})`,
            severity: "error",
          });
        }
      }
    }
  }

  // ── 2. Publication counts ─────────────────────────────────────────────────
  const pubCount = pubs.length;
  if (pubCount > 0) {
    for (const match of draft.matchAll(/\b(\d+)\s+(?:peer-reviewed\s+)?(?:publications?|papers?|articles?|manuscripts?)/gi)) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && Math.abs(n - pubCount) > 1) {
        flags.push({
          text: match[0],
          reason: `Publication count ${n} does not match evidence (${pubCount} on record; ±1 allowed for in-press)`,
          severity: "error",
        });
      }
    }
  }

  // ── 3. Grant amounts ──────────────────────────────────────────────────────
  const grants = (q.grants ?? []) as Array<{ amount?: number }>;
  const knownAmounts = grants
    .map(g => g.amount)
    .filter((a): a is number => typeof a === "number" && a > 0);

  if (knownAmounts.length > 0) {
    for (const match of draft.matchAll(/\$(\d[\d,]+(?:\.\d+)?)\s*(K|M|B|thousand|million|billion)?/gi)) {
      const raw = parseFloat(match[1].replace(/,/g, ""));
      const sfx = (match[2] ?? "").toUpperCase().charAt(0);
      const multiplier = sfx === "K" ? 1_000 : sfx === "M" ? 1_000_000 : sfx === "B" ? 1_000_000_000 : 1;
      const n = raw * multiplier;
      if (!isNaN(n) && n >= 1_000) {
        const isKnown = knownAmounts.some(known => Math.abs(known - n) / Math.max(known, 1) <= 0.02);
        if (!isKnown) {
          flags.push({
            text: match[0],
            reason: `Amount ${match[0]} not found in grant evidence (known: ${knownAmounts.map(a => `$${a.toLocaleString()}`).join(", ")})`,
            severity: "warning",
          });
        }
      }
    }
  }

  // ── 4. Award / prize names ────────────────────────────────────────────────
  const awards = (q.awards ?? []) as Array<{ name?: string }>;
  const knownAwardNames = awards
    .map(a => a.name?.toLowerCase().trim())
    .filter((n): n is string => !!n);

  if (knownAwardNames.length > 0) {
    for (const match of draft.matchAll(/\b([A-Z][A-Za-z\s\-']{2,50}(?:Award|Prize|Fellowship))\b/g)) {
      const mentioned = match[0].toLowerCase();
      const cleaned = mentioned.replace(/\s*(award|prize|fellowship)\s*/gi, "").trim();
      const isKnown = knownAwardNames.some(known => {
        const knownCleaned = known.replace(/\s*(award|prize|fellowship)\s*/gi, "").trim();
        return known.includes(cleaned) || cleaned.includes(knownCleaned) || mentioned.includes(known);
      });
      if (!isKnown) {
        flags.push({
          text: match[0],
          reason: `Honor "${match[0]}" not found in evidence (known: ${knownAwardNames.join("; ")})`,
          severity: "warning",
        });
      }
    }
  }

  // ── 5. Recommender names ──────────────────────────────────────────────────
  const recs = context.recommenders ?? [];
  const knownRecNames = recs
    .map(r => r.name?.toLowerCase().trim())
    .filter((n): n is string => !!n);

  if (knownRecNames.length > 0) {
    for (const match of draft.matchAll(/\b(?:Prof(?:essor)?|Dr)\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g)) {
      const lastName = (match[1].split(/\s+/).pop() ?? "").toLowerCase();
      if (lastName.length > 2) {
        const isKnown = knownRecNames.some(known =>
          known.includes(lastName) || known.split(/\s+/).some(w => w === lastName)
        );
        if (!isKnown) {
          flags.push({
            text: match[0],
            reason: `Person "${match[0]}" not found in recommender list (known: ${knownRecNames.join(", ")})`,
            severity: "warning",
          });
        }
      }
    }
  }

  return flags;
}

export async function runGroundingCheck(
  draft: string,
  context: GroundingContext | Record<string, unknown>
): Promise<GroundingFlag[]> {
  // Support legacy call signature: runGroundingCheck(draft, qualifications)
  const normalized: GroundingContext = isGroundingContext(context)
    ? context
    : { qualifications: context as CaseQualifications };

  // Deterministic pre-pass — zero cost, immune to LLM outages
  const deterministicFlags = runDeterministicPrePass(draft, normalized);

  const evidenceSummary = buildEvidenceSummary(normalized);

  const userMessage = `DRAFT:
${draft}

EVIDENCE:
${evidenceSummary}`;

  let raw: string;
  try {
    raw = await complete(
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      { tier: "fast", temperature: 0, maxTokens: 800, usageContext: { route: "grounding" } }
    );
  } catch {
    // LLM unavailable — fail CLOSED: return deterministic flags + sentinel so
    // callers know the LLM audit didn't run (deterministic flags are preserved).
    return [
      ...deterministicFlags,
      { text: "[audit unavailable]", reason: "Grounding auditor could not run — treat all claims as unaudited until re-checked", severity: "error" },
    ];
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return [
        ...deterministicFlags,
        { text: "[audit parse error]", reason: "Grounding auditor returned an unparseable response — treat all claims as unaudited", severity: "error" },
      ];
    }
    const parsed = JSON.parse(match[0]) as { flags?: GroundingFlag[] };
    // Deterministic flags first (pre-pass), then LLM flags (semantic pass)
    return [...deterministicFlags, ...(parsed.flags ?? [])];
  } catch {
    return [
      ...deterministicFlags,
      { text: "[audit parse error]", reason: "Grounding auditor returned an unparseable response — treat all claims as unaudited", severity: "error" },
    ];
  }
}

function isGroundingContext(v: unknown): v is GroundingContext {
  if (!v || typeof v !== "object") return false;
  const keys = Object.keys(v);
  return keys.some(k => ["qualifications", "endeavor", "recommenders"].includes(k));
}

function buildEvidenceSummary(ctx: GroundingContext): string {
  const lines: string[] = [];

  // ── Qualifications ───────────────────────────────────────────────────────
  const q = ctx.qualifications ?? {};

  const pubs = (q.publications as CaseQualifications["publications"]) ?? [];
  if (pubs.length) {
    lines.push("PUBLICATIONS:");
    pubs.forEach((p, i) => {
      const parts = [
        p.title ? `"${p.title}"` : null,
        p.venue ? `venue: ${p.venue}` : null,
        typeof p.citations === "number" ? `citations: ${p.citations}` : null,
        typeof p.impactFactor === "number" ? `IF: ${p.impactFactor}` : null,
      ].filter(Boolean);
      lines.push(`  ${i + 1}. ${parts.join(", ")}`);
    });
  }

  const awards = (q.awards as CaseQualifications["awards"]) ?? [];
  if (awards.length) {
    lines.push("AWARDS:");
    awards.forEach((a, i) => {
      lines.push(`  ${i + 1}. ${a.name ?? ""}${a.issuer ? ` (${a.issuer})` : ""}`);
    });
  }

  const grants = (q.grants as CaseQualifications["grants"]) ?? [];
  if (grants.length) {
    lines.push("GRANTS:");
    grants.forEach((g, i) => {
      const parts = [
        g.title ? `"${g.title}"` : null,
        g.funder ? `funder: ${g.funder}` : null,
        typeof g.amount === "number" ? `$${g.amount.toLocaleString()}` : null,
      ].filter(Boolean);
      lines.push(`  ${i + 1}. ${parts.join(", ")}`);
    });
  }

  const roles = (q.editorialRoles as CaseQualifications["editorialRoles"]) ?? [];
  if (roles.length) {
    lines.push("EDITORIAL ROLES:");
    roles.forEach((r, i) => {
      lines.push(`  ${i + 1}. ${r.journal ?? r.venue ?? ""}`);
    });
  }

  // ── Endeavor ─────────────────────────────────────────────────────────────
  const e = ctx.endeavor ?? {};
  const nstc = Array.isArray(e.nstcCategories) ? (e.nstcCategories as string[]) : [];
  if (nstc.length) lines.push(`NSTC_CATEGORIES: ${nstc.join(", ")}`);

  const programs = Array.isArray(e.federalPrograms)
    ? (e.federalPrograms as Array<{ programName?: string; agencyOrOffice?: string }>)
    : [];
  if (programs.length) {
    lines.push("FEDERAL_PROGRAMS:");
    programs.forEach((p, i) => {
      lines.push(`  ${i + 1}. ${p.programName ?? ""}${p.agencyOrOffice ? ` — ${p.agencyOrOffice}` : ""}`);
    });
  }

  if (e.endeavorField) lines.push(`FIELD: ${String(e.endeavorField)}`);

  // ── Recommenders ─────────────────────────────────────────────────────────
  const recs = ctx.recommenders ?? [];
  if (recs.length) {
    lines.push("RECOMMENDERS:");
    recs.forEach((r, i) => {
      const parts = [r.name, r.title, r.institution, r.department].filter(Boolean).join(", ");
      lines.push(`  ${i + 1}. ${parts}`);
    });
  }

  // ── Uploaded documents (CV, personal statement, etc.) ────────────────────
  // Include truncated raw text so the LLM auditor can verify claims that appear
  // in uploaded docs but not in the structured evidence (e.g. a paper title
  // mentioned in a CV that wasn't entered as a structured publication).
  // Cap per-doc: 1500 chars (~375 tokens). Cap total docs: 3.
  const docs = (ctx.documents ?? []).slice(0, 3).filter(d => d.content.trim().length > 0);
  if (docs.length) {
    lines.push("DOCUMENTS (applicant-provided text):");
    docs.forEach((d, i) => {
      const label = d.name ? ` [${d.name}]` : "";
      const body = d.content.length > 1500 ? d.content.slice(0, 1500) + "…(truncated)" : d.content;
      lines.push(`  --- Document ${i + 1}${label} ---`);
      lines.push(`  ${body.replace(/\n/g, "\n  ")}`);
    });
  }

  return lines.length ? lines.join("\n") : "(no structured evidence provided)";
}

// ---------------------------------------------------------------------------
// Brief-level grounding + credibility scoring
// ---------------------------------------------------------------------------

export async function runBriefGroundingCheck(
  brief: { substantialMerit: string; nationalImportance: string; waiverJustification: string },
  context: GroundingContext,
): Promise<BriefQualityReport> {
  const [smFlags, niFlags, wjFlags, credibility] = await Promise.all([
    runGroundingCheck(brief.substantialMerit, context),
    runGroundingCheck(brief.nationalImportance, context),
    runGroundingCheck(brief.waiverJustification, context),
    scoreBriefCredibility(brief, context),
  ]);

  return {
    flags: {
      substantialMerit: smFlags,
      nationalImportance: niFlags,
      waiverJustification: wjFlags,
    },
    partnerCredibilityScore: credibility.score,
    credibilityNotes: credibility.notes,
  };
}

const CREDIBILITY_PROMPT = `You are a managing partner at a top-25 U.S. immigration law firm reviewing a draft NIW petition brief prepared by a junior associate (AI-assisted).

You will be given three sections of a Dhanasar brief and the applicant's evidence record. Score the brief on a 0-100 scale answering ONE question:

"Would I attach this brief to a cold outreach email to a prospective client's employer, knowing my firm's reputation is on the line?"

SCORING CRITERIA (weighted):
- Legal framework accuracy (25%): Are Dhanasar prongs correctly identified and argued? Is the legal standard stated accurately?
- Evidence grounding (25%): Does every factual claim trace to the evidence record? Any hallucinated stats, names, or journals?
- Persuasive quality (20%): Does it read like attorney prose, not a term paper? Specific over general? Does it make the case or just describe the applicant?
- Completeness (15%): All three prongs substantively addressed? Any section feel thin or boilerplate?
- AI-slop absence (15%): No "testament to", "delve into", "landscape", "underscores", "Furthermore" paragraph starters, or other formulaic AI patterns?

SCORE GUIDE:
90-100: Ready to send. Minor polish at most.
80-89: Strong draft. 1-2 specific fixes needed, but the bones are right.
70-79: Serviceable. Needs a real edit pass — some sections are generic or under-argued.
60-69: Below threshold. Significant rewriting needed. Would not attach to outreach.
Below 60: Not usable. Fundamental issues with accuracy, structure, or tone.

Return ONLY valid JSON:
{"score": <number>, "notes": "<2-3 sentences: what specifically needs fixing, or why it's ready>"}`;

async function scoreBriefCredibility(
  brief: { substantialMerit: string; nationalImportance: string; waiverJustification: string },
  context: GroundingContext,
): Promise<{ score: number; notes: string }> {
  const evidenceSummary = buildEvidenceSummary(context);

  const fullBrief = `## PRONG 1A — SUBSTANTIAL MERIT\n${brief.substantialMerit}\n\n## PRONG 1B — NATIONAL IMPORTANCE\n${brief.nationalImportance}\n\n## PRONG 3 — WAIVER JUSTIFICATION\n${brief.waiverJustification}`;

  try {
    const result = await completeStructured<{ score: number; notes: string }>(
      [
        { role: "system", content: CREDIBILITY_PROMPT },
        { role: "user", content: `BRIEF:\n${fullBrief}\n\nEVIDENCE RECORD:\n${evidenceSummary}\n\nScore this brief now:` },
      ],
      {
        tier: "fast",
        temperature: 0,
        maxTokens: 300,
        usageContext: { route: "dossier/credibility-score" },
      },
    );

    return {
      score: Math.max(0, Math.min(100, Math.round(result.score ?? 0))),
      notes: String(result.notes ?? ""),
    };
  } catch {
    return { score: 0, notes: "Credibility scoring unavailable" };
  }
}
