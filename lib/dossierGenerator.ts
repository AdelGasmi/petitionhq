import { readCase } from "./db";
import { buildExhibitRows, exhibitRowsToMarkdown, type ExhibitRow } from "./exhibitPlan";
import { complete, completeStructured, type LlmMessage } from "./lmstudio";
import { extractEvidence, filterFormDataByLedger, type EvidenceAtom } from "./drafting";
import { applyClaimLedger } from "./claimLedger";
import { prisma } from "./prisma";
import { runBriefGroundingCheck, type BriefQualityReport, type GroundingContext } from "./groundingCheck";
import { lintDossierProvenance, type LintResult } from "./dossier/provenanceLinter";
import logger from "./logger";

export type NarrativeSkeleton = {
  substantialMerit: string[];
  nationalImportance: string[];
  waiverJustification: string[];
};

export type DossierBrief = {
  substantialMerit: string;
  nationalImportance: string;
  waiverJustification: string;
};

/**
 * Provenance stamp for a signed curation gate. Present on the dossier only when
 * the claiming attorney has attested the approved claim set. Rendered on the
 * cover page as the tamper-evident, malpractice-defense artifact.
 */
export type DossierAttestation = {
  /** sha256 over the sorted approved atom-id set (Case.claimLedger.ledgerRoot). */
  ledgerRoot: string;
  /** ISO-8601 timestamp the attorney signed. */
  attestedAt: string;
  /** Display name of the attesting attorney, if resolvable. */
  attorneyName: string | null;
};

export type DossierData = {
  caseId: string;
  field: string;
  tier: string;
  score: number | null;
  exhibitRows: ExhibitRow[];
  exhibitMarkdown: string;
  skeleton: NarrativeSkeleton;
  brief: DossierBrief;
  qualityReport: BriefQualityReport;
  provenanceLint: LintResult;
  /** @deprecated kept for backward compat — equals brief.substantialMerit */
  prong1Draft: string;
  applicantName: string;
  formData: Record<string, unknown>;
  /** Signed curation-gate stamp; null until the attorney attests the claim set. */
  attestation: DossierAttestation | null;
};

// ---------------------------------------------------------------------------
// Skeleton pass (Haiku — picks atoms per prong)
// ---------------------------------------------------------------------------

export async function buildNarrativeSkeleton(
  atoms: EvidenceAtom[],
  endeavorContext: {
    field: string;
    endeavorStatement: string;
    nstcCategories: string[];
    federalPrograms: string[];
  },
): Promise<NarrativeSkeleton> {
  if (!atoms.length) {
    return { substantialMerit: [], nationalImportance: [], waiverJustification: [] };
  }

  const atomList = atoms.map(a =>
    `${a.id} | ${a.kind} | ${a.summary}${a.metric ? ` (${a.metric})` : ""}${a.year ? `, ${a.year}` : ""}${a.detail ? ` — ${a.detail}` : ""}`
  ).join("\n");

  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You are a senior NIW immigration attorney analyzing evidence for a Matter of Dhanasar (2016) petition.

Your task: given the applicant's evidence atoms and endeavor context, select the 3-5 STRONGEST atoms for each Dhanasar prong. An atom can appear in multiple prongs if relevant.

PRONG DEFINITIONS:
- substantialMerit: Evidence that the proposed endeavor has substantial merit. Focus on the applicant's specific contributions, expertise, and track record that demonstrate the endeavor's value. Strong atoms: high-impact publications, significant grants, patents with real-world application, prestigious awards.
- nationalImportance: Evidence tying the endeavor to U.S. national interest. Focus on NSTC alignment, federal program relevance, broad societal impact. Strong atoms: federally funded grants, publications in nationally prioritized areas, work cited by government bodies.
- waiverJustification: Evidence that this specific person should bypass the labor certification process. Focus on what makes the applicant uniquely positioned — independent recognition, citations by others, editorial roles, invited talks, media coverage. Strong atoms: high citation counts, independent expert recognition, editorial/review roles, media coverage.

RULES:
- Return ONLY valid atom IDs from the provided list
- Pick 3-5 atoms per prong (fewer if the evidence pool is thin)
- Prioritize atoms with quantitative metrics (citations, impact factors, grant amounts)
- An atom can appear in multiple prongs

Return ONLY a JSON object with this exact shape:
{"substantialMerit": ["id1", ...], "nationalImportance": ["id1", ...], "waiverJustification": ["id1", ...]}`,
    },
    {
      role: "user",
      content: `FIELD: ${endeavorContext.field}
PROPOSED ENDEAVOR: ${endeavorContext.endeavorStatement}
NSTC CATEGORIES: ${endeavorContext.nstcCategories.length ? endeavorContext.nstcCategories.join(", ") : "none"}
FEDERAL PROGRAMS: ${endeavorContext.federalPrograms.length ? endeavorContext.federalPrograms.join("; ") : "none"}

EVIDENCE ATOMS:
${atomList}

Select the strongest atoms per prong now:`,
    },
  ];

  const validIds = new Set(atoms.map(a => a.id));

  try {
    const result = await completeStructured<NarrativeSkeleton>(messages, {
      tier: "fast",
      temperature: 0,
      maxTokens: 500,
      usageContext: { route: "dossier/skeleton" },
    });

    return {
      substantialMerit: (result.substantialMerit ?? []).filter(id => validIds.has(id)),
      nationalImportance: (result.nationalImportance ?? []).filter(id => validIds.has(id)),
      waiverJustification: (result.waiverJustification ?? []).filter(id => validIds.has(id)),
    };
  } catch {
    return { substantialMerit: [], nationalImportance: [], waiverJustification: [] };
  }
}

// ---------------------------------------------------------------------------
// Section generators (Sonnet @ 0.4 — one per Dhanasar prong)
// ---------------------------------------------------------------------------

function formatAtomsForPrompt(atoms: EvidenceAtom[]): string {
  if (!atoms.length) return "(no specific evidence selected — draft broadly from context)";
  return atoms.map(ev =>
    `- [${ev.kind}] ${ev.summary}${ev.metric ? ` (${ev.metric})` : ""}${ev.year ? `, ${ev.year}` : ""}${ev.detail ? ` — ${ev.detail}` : ""}`
  ).join("\n");
}

const SHARED_RULES = `RULES:
- Write in a formal legal brief style. Use the petitioner's name or "the Petitioner."
- Use only the evidence provided. Do not invent citations, journal names, or statistics.
- Every factual claim must map to an evidence atom listed below.
- Target length: 400-600 words for this section.
- No em-dashes. No phrases like "testament to", "delve into", "it is worth noting", "underscore", "landscape."
- Do not start paragraphs with "Moreover," "Furthermore," "Additionally," or "In conclusion."
- Write as a practicing attorney would — direct, specific, persuasive. Not academic, not promotional.

PROVENANCE TAGGING (critical):
For each factual claim in your draft:
  - If the claim appears in <verified_claims> below, cite the source inline:
      "12 publications [OpenAlex]" or "PhD from Stanford University [ROR]"
  - If the claim is NOT in <verified_claims>, wrap it:
      "[self-reported: served as ad-hoc reviewer for Nature Communications]"
  - Do NOT invent claims. Do NOT inflate numbers.
  - Numbers, institution names, and grant/patent details MUST be either cited or tagged.`;

const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  orcid: "ORCID",
  ror: "ROR",
  nsf: "NSF",
  nih: "NIH",
  uspto: "USPTO",
  crossref: "Crossref",
};

function formatVerifiedClaimsForPrompt(
  claims: Record<string, VerifiedClaimEntry> | null | undefined,
): string {
  if (!claims || Object.keys(claims).length === 0) {
    return "<verified_claims>\n(no verified claims available — tag all factual claims as [self-reported: ...])\n</verified_claims>";
  }

  const lines = Object.entries(claims)
    .filter(([key]) => key !== "preliminary")
    .map(([key, c]) => {
      const src = SOURCE_LABELS[c.source] ?? c.source;
      return `- ${key}: status=${c.status}, source=${src}${c.detail ? `, detail="${c.detail}"` : ""}${c.sourceUrl ? `, url=${c.sourceUrl}` : ""}`;
    });

  return `<verified_claims>\n${lines.join("\n")}\n</verified_claims>`;
}

type VerifiedClaimEntry = { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string };

type SectionContext = {
  applicantName: string;
  field: string;
  endeavorStatement: string;
  nstcCategories: string[];
  federalPrograms: string[];
  totalCitations: number;
  exhibitMarkdown: string;
  caseId: string;
  leadId?: string;
  verifiedClaims?: Record<string, VerifiedClaimEntry> | null;
};

async function generateSubstantialMerit(
  atoms: EvidenceAtom[],
  ctx: SectionContext,
): Promise<string> {
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You are a senior NIW immigration attorney drafting the "Substantial Merit" subsection of Prong 1 for an I-140 EB-2 NIW petition brief under Matter of Dhanasar (2016).

This section argues that the petitioner's proposed endeavor has SUBSTANTIAL MERIT. Focus on:
- The petitioner's specific, concrete contributions to their field
- Quality and impact of their research, publications, or professional work
- Tangible outcomes: publications in high-impact venues, significant citation counts, funded grants, patents
- The endeavor's practical value — not just academic interest

${SHARED_RULES}`,
    },
    {
      role: "user",
      content: `Draft the "Substantial Merit" subsection for this petition.

PETITIONER: ${ctx.applicantName}
FIELD: ${ctx.field}
PROPOSED ENDEAVOR: ${ctx.endeavorStatement}
TOTAL CITATIONS: ${ctx.totalCitations > 0 ? ctx.totalCitations : "unknown"}

ANCHOR EVIDENCE (build the argument around these):
${formatAtomsForPrompt(atoms)}

${formatVerifiedClaimsForPrompt(ctx.verifiedClaims)}

EXHIBIT PLAN:
${ctx.exhibitMarkdown}

Write the Substantial Merit subsection now:`,
    },
  ];

  return complete(messages, {
    tier: "drafting",
    temperature: 0.4,
    maxTokens: 2000,
    usageContext: { caseId: ctx.caseId, leadId: ctx.leadId, route: "dossier/substantial-merit" },
  });
}

async function generateNationalImportance(
  atoms: EvidenceAtom[],
  ctx: SectionContext,
): Promise<string> {
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You are a senior NIW immigration attorney drafting the "National Importance" subsection of Prong 1 for an I-140 EB-2 NIW petition brief under Matter of Dhanasar (2016).

This section argues that the petitioner's proposed endeavor has NATIONAL IMPORTANCE to the United States. Focus on:
- Explicit ties to U.S. federal priorities: NSTC Critical & Emerging Technologies list, named federal programs (NIH, DoD, NIST, NSF, DOE)
- Broad impact beyond a single institution or locality
- Alignment with documented U.S. policy goals or strategic initiatives
- How the endeavor addresses a national need, not just advances a field

The bar is "national importance," not "interesting research." Connect the dots to U.S. priorities explicitly.

${SHARED_RULES}`,
    },
    {
      role: "user",
      content: `Draft the "National Importance" subsection for this petition.

PETITIONER: ${ctx.applicantName}
FIELD: ${ctx.field}
PROPOSED ENDEAVOR: ${ctx.endeavorStatement}
NSTC CATEGORIES: ${ctx.nstcCategories.length ? ctx.nstcCategories.join(", ") : "none identified"}
FEDERAL PROGRAMS:
  ${ctx.federalPrograms.length ? ctx.federalPrograms.join("\n  ") : "(none specified)"}

ANCHOR EVIDENCE (build the argument around these):
${formatAtomsForPrompt(atoms)}

${formatVerifiedClaimsForPrompt(ctx.verifiedClaims)}

EXHIBIT PLAN:
${ctx.exhibitMarkdown}

Write the National Importance subsection now:`,
    },
  ];

  return complete(messages, {
    tier: "drafting",
    temperature: 0.4,
    maxTokens: 2000,
    usageContext: { caseId: ctx.caseId, leadId: ctx.leadId, route: "dossier/national-importance" },
  });
}

async function generateWaiverJustification(
  atoms: EvidenceAtom[],
  ctx: SectionContext,
): Promise<string> {
  const messages: LlmMessage[] = [
    {
      role: "system",
      content: `You are a senior NIW immigration attorney drafting the "Prong 3 — Waiver Justification" section for an I-140 EB-2 NIW petition brief under Matter of Dhanasar (2016).

This section argues that, on balance, it would benefit the United States to waive the job offer and labor certification requirement for THIS SPECIFIC petitioner. Focus on:
- Why this person is uniquely positioned — not interchangeable with any qualified worker
- Independent recognition: citations by researchers outside the petitioner's group, editorial/reviewer roles, invited talks, media coverage
- What would be lost or delayed if the petitioner had to go through PERM labor certification
- The urgency or time-sensitivity of the endeavor (if applicable)
- The impracticality of the labor certification process for this type of work

This is the "why them, why now" argument. Generic qualifications are not enough. Show what makes the petitioner irreplaceable.

${SHARED_RULES}`,
    },
    {
      role: "user",
      content: `Draft the "Prong 3 — Waiver Justification" section for this petition.

PETITIONER: ${ctx.applicantName}
FIELD: ${ctx.field}
PROPOSED ENDEAVOR: ${ctx.endeavorStatement}
TOTAL CITATIONS: ${ctx.totalCitations > 0 ? ctx.totalCitations : "unknown"}

ANCHOR EVIDENCE (build the argument around these):
${formatAtomsForPrompt(atoms)}

${formatVerifiedClaimsForPrompt(ctx.verifiedClaims)}

EXHIBIT PLAN:
${ctx.exhibitMarkdown}

Write the Waiver Justification section now:`,
    },
  ];

  return complete(messages, {
    tier: "drafting",
    temperature: 0.4,
    maxTokens: 2000,
    usageContext: { caseId: ctx.caseId, leadId: ctx.leadId, route: "dossier/waiver-justification" },
  });
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export async function generateDossier(
  caseId: string,
  tier: string,
  score: number | null,
  leadId?: string,
  verifiedClaims?: Record<string, VerifiedClaimEntry> | null,
): Promise<DossierData> {
  const c = await readCase(caseId);
  if (!c) throw new Error(`Case ${caseId} not found`);

  const fd = c.formData ?? {};

  // ── Curate formData to the approved claim set (the form-level interceptor) ─
  // Project formData down to ONLY the approved claims BEFORE deriving anything
  // that feeds the dossier. The exhibit table, citation totals, and the PDF
  // profile summary all read raw `qualifications` arrays; without this they
  // aggregate EXCLUDED claims (inflated citation counts, leaked venues) even
  // though the prose itself is atom-filtered. A null ledger ⇒ formData
  // unchanged (un-curated default). Everything below derives from curatedFd.
  const curatedFd = filterFormDataByLedger(fd, c.claimLedger ?? null);
  const q = (curatedFd.qualifications ?? {}) as Record<string, unknown>;
  const e = (curatedFd.endeavor ?? {}) as Record<string, unknown>;
  const p = (curatedFd.petitionerInfo ?? {}) as Record<string, unknown>;

  const field = String(e.endeavorField ?? q.endeavorField ?? "Research");
  const applicantName = [p.givenName, p.familyName].filter(Boolean).join(" ") || "Applicant";

  const exhibitRows = buildExhibitRows(curatedFd, c.letters);
  const exhibitMarkdown = exhibitRowsToMarkdown(exhibitRows);

  // Atoms for the prose are extracted from the SAME curated formData, so they
  // already exclude rejected claims. applyClaimLedger below stays as the
  // authoritative atom-level interceptor (belt-and-braces).
  const allEvidence = extractEvidence(curatedFd);

  // ── Attorney curation gate (the atom-level interceptor) ───────────────────
  // Filter the atom stream to what the claiming attorney approved BEFORE any
  // prose is generated. A null ledger (the default until the gate UI writes
  // one) means "all atoms allowed". A present ledger with an empty approve-set
  // yields zero atoms — see applyClaimLedger; do NOT add an "?? allEvidence"
  // fallback here, that would re-admit excluded claims (a silent placebo).
  const curatedEvidence = applyClaimLedger(allEvidence, c.claimLedger);

  const endeavorStatement = String(e.endeavorStatement ?? `advancing research in ${field}`);
  const nstcCategories = Array.isArray(e.nstcCategories) && (e.nstcCategories as string[]).length
    ? (e.nstcCategories as string[])
    : [];
  const federalPrograms = Array.isArray(e.federalPrograms)
    ? (e.federalPrograms as Record<string, unknown>[])
        .filter(fp => fp.programName)
        .map(fp => `${fp.programName}${fp.agencyOrOffice ? ` — ${fp.agencyOrOffice}` : ""}${fp.specificGoal ? ` (goal: ${fp.specificGoal})` : ""}`)
    : [];

  const pubs = Array.isArray(q.publications) ? q.publications as Record<string, unknown>[] : [];
  const totalCitations = pubs.reduce((s, p) => s + (typeof p.citations === "number" ? p.citations : 0), 0);

  // Step 1: Skeleton pass — pick strongest atoms per prong
  const skeleton = await buildNarrativeSkeleton(curatedEvidence, {
    field,
    endeavorStatement,
    nstcCategories,
    federalPrograms,
  });

  // Resolve atom IDs to full atoms for each prong
  const atomMap = new Map(curatedEvidence.map(a => [a.id, a]));
  const resolveAtoms = (ids: string[]) =>
    ids.map(id => atomMap.get(id)).filter(Boolean) as EvidenceAtom[];

  const meritAtoms = resolveAtoms(skeleton.substantialMerit);
  const importanceAtoms = resolveAtoms(skeleton.nationalImportance);
  const waiverAtoms = resolveAtoms(skeleton.waiverJustification);

  // Fall back to the curated evidence set if the skeleton returned empty
  const meritInput = meritAtoms.length ? meritAtoms : curatedEvidence;
  const importanceInput = importanceAtoms.length ? importanceAtoms : curatedEvidence;
  const waiverInput = waiverAtoms.length ? waiverAtoms : curatedEvidence;

  const sectionCtx: SectionContext = {
    applicantName,
    field,
    endeavorStatement,
    nstcCategories,
    federalPrograms,
    totalCitations,
    exhibitMarkdown,
    caseId,
    leadId,
    verifiedClaims,
  };

  // Step 2: Generate all three sections in parallel
  const [substantialMerit, nationalImportance, waiverJustification] = await Promise.all([
    generateSubstantialMerit(meritInput, sectionCtx),
    generateNationalImportance(importanceInput, sectionCtx),
    generateWaiverJustification(waiverInput, sectionCtx),
  ]);

  const brief: DossierBrief = {
    substantialMerit,
    nationalImportance,
    waiverJustification,
  };

  // Step 3: Grounding check + credibility score
  const uploadedDocs = Object.entries(c.documents ?? {})
    .filter(([, doc]) => doc.pastedText?.trim())
    .map(([reqId, doc]) => ({ name: reqId, content: doc.pastedText! }));

  const groundingContext: GroundingContext = {
    qualifications: q as GroundingContext["qualifications"],
    endeavor: e as GroundingContext["endeavor"],
    recommenders: Array.isArray(fd.recommenders)
      ? (fd.recommenders as GroundingContext["recommenders"])
      : [],
    documents: uploadedDocs.length ? uploadedDocs : undefined,
  };

  const qualityReport = await runBriefGroundingCheck(brief, groundingContext);

  // Provenance lint — flag untagged factual claims
  const provenanceLint = lintDossierProvenance(
    [
      { name: "substantialMerit", text: substantialMerit },
      { name: "nationalImportance", text: nationalImportance },
      { name: "waiverJustification", text: waiverJustification },
    ],
    verifiedClaims ?? null,
  );

  if (provenanceLint.issues.length > 0) {
    logger.warn(
      `[dossier] Provenance lint: ${provenanceLint.issues.length} untagged claims in case ${caseId}`,
      provenanceLint.stats,
    );
  }

  // Attestation stamp — populated only when the gate has actually been signed
  // (a ledgerRoot AND an attestedAt). A ledger that merely exists (e.g. seeded
  // approve set, not yet attested) yields no stamp, so the cover page never
  // claims an attestation that didn't happen.
  const ledger = c.claimLedger ?? null;
  let attestation: DossierAttestation | null = null;
  if (ledger?.ledgerRoot && ledger.attestedAt) {
    let attorneyName: string | null = null;
    if (ledger.attestedBy) {
      const u = await prisma.user
        .findUnique({ where: { id: ledger.attestedBy }, select: { name: true } })
        .catch(() => null);
      attorneyName = u?.name ?? null;
    }
    attestation = {
      ledgerRoot: ledger.ledgerRoot,
      attestedAt: ledger.attestedAt,
      attorneyName,
    };
  }

  return {
    caseId,
    field,
    tier,
    score,
    exhibitRows,
    exhibitMarkdown,
    skeleton,
    brief,
    qualityReport,
    provenanceLint,
    prong1Draft: substantialMerit,
    applicantName,
    formData: curatedFd,
    attestation,
  };
}
