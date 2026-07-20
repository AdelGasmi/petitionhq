import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { readCase, patchFormData } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import { getForm } from "@/forms";
import { extractEvidence } from "@/lib/drafting";
import { completeStream, type LlmOptions } from "@/lib/lmstudio";
import { runGroundingCheck, resolveOffsets } from "@/lib/groundingCheck";
import { getOrGenerateLedger, getCachedLedger } from "@/lib/evidenceLedger";
import { resolveDraftingGuidance } from "@/lib/attorneyRules";
import { bannedWordsBlock } from "@/lib/prompts/constants";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; narrativeId: string; sectionId: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id, narrativeId, sectionId } = await params;
  type ReqBody = { issueContext?: string; previousDraftExcerpts?: Array<{ heading: string; excerpt: string }> };
  const body = await req.json().catch(() => ({})) as ReqBody;
  const issueContext = body.issueContext?.trim() ?? "";
  const previousDraftExcerpts = body.previousDraftExcerpts ?? [];

  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return new Response("not found", { status: 404 });
  if (!(await canDraftCase(session, c))) return new Response("Forbidden", { status: 403 });
  if (session.role === "applicant" && (await betaCostCapReached(id)))
    return new Response(BETA_LIMIT_MESSAGE, { status: 429 });

  const form = getForm(c.formId);
  if (!form) return new Response("form not found", { status: 404 });

  const narrative = form.narratives?.find((n) => n.id === narrativeId);
  if (!narrative) return new Response("narrative not found", { status: 404 });

  const section = narrative.outline.find((s) => s.id === sectionId);
  if (!section) return new Response("section not found", { status: 404 });

  const petitionerInfo = (c.formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const endeavor = (c.formData.endeavor ?? {}) as Record<string, unknown>;
  const qualifications = (c.formData.qualifications ?? {}) as Record<string, unknown>;
  const fullName = petitionerInfo.fullName
    ? String(petitionerInfo.fullName)
    : [petitionerInfo.givenName, petitionerInfo.middleName, petitionerInfo.familyName]
        .filter(Boolean).join(" ") || "The Petitioner";

  const allEvidence = extractEvidence(c.formData);
  const evidenceText = allEvidence.length
    ? allEvidence
        .map((e) =>
          `- [${e.kind}] ${e.summary}${e.metric ? ` (${e.metric})` : ""}${e.year ? `, ${e.year}` : ""}${e.detail ? ` — ${e.detail}` : ""}`
        )
        .join("\n")
    : "(no evidence entered — draft carefully and note where specificity is needed)";

  // Evidence ledger — neutral third-person fact sheet (generated once, cached).
  // Try the cache first (zero latency); generate fresh only if stale.
  // Generation happens in the background after response starts streaming so it
  // never blocks draft latency when the cache is warm.
  let ledgerProse = "";
  try {
    const cached = getCachedLedger(c.formData);
    if (cached) {
      ledgerProse = cached.prose;
    } else {
      // Generate and persist asynchronously — don't await, don't block the draft
      getOrGenerateLedger(c.formData).then((ledger) =>
        patchFormData(c.id, { evidenceLedger: ledger }).catch(() => {})
      ).catch(() => {});
    }
  } catch { /* ledger is best-effort */ }

  // Build per-prong evidence atoms from enriched formData
  const proposedEndeavor = String(endeavor.endeavorStatement ?? "(not specified)");
  const nstcCategories = Array.isArray(endeavor.nstcCategories) && (endeavor.nstcCategories as string[]).length
    ? (endeavor.nstcCategories as string[]).join(", ")
    : "none";
  const federalPrograms = Array.isArray(endeavor.federalPrograms)
    ? (endeavor.federalPrograms as Record<string, unknown>[])
        .filter(p => p.programName)
        .map(p => `${p.programName}${p.agencyOrOffice ? ` — ${p.agencyOrOffice}` : ""}${p.specificGoal ? ` (goal: ${p.specificGoal})` : ""}`)
        .join("\n  ")
    : "";
  const broadDissemination = endeavor.researchIsPublished !== false;

  const publications = Array.isArray(qualifications.publications)
    ? (qualifications.publications as Record<string, unknown>[]).map(p =>
        `  - ${p.title}${p.venue ? ` | ${p.venue}` : ""}${p.year ? ` | ${p.year}` : ""}${p.citations !== undefined ? ` | ${p.citations} citations` : ""}${p.impactFactor !== undefined ? ` | IF=${p.impactFactor}` : ""}${p.journalRank ? ` | ${p.journalRank}` : ""}${p.citationPercentile !== undefined ? ` | ESI ${p.citationPercentile}th pctile` : ""}${p.esiFieldAverage !== undefined ? ` (field avg ${p.esiFieldAverage})` : ""}`
      ).join("\n")
    : "";
  const notableCitations = Array.isArray(qualifications.notableCitations)
    ? (qualifications.notableCitations as Record<string, unknown>[])
        .filter(c => c.citingAuthor || c.citingJournal)
        .map(c => `  - ${c.citingAuthor ?? ""}${c.citingYear ? ` (${c.citingYear})` : ""}${c.citingJournal ? `, ${c.citingJournal}` : ""}${c.howUsed ? `: ${c.howUsed}` : ""}`)
        .join("\n")
    : "";
  const peerReviewCount = Array.isArray(qualifications.editorialRoles)
    ? (qualifications.editorialRoles as unknown[]).length : 0;
  const letterValues = Object.values(c.letters ?? {});
  const governmentalRl = letterValues.find(l => l.recommender?.kind === "governmental");

  // Determine prong type for section-specific injection
  const isProng1 = ["prong1", "brief-prong1", "prong1-importance", "prong1-nstc"].some(k => sectionId.includes(k)) || sectionId.includes("importance");
  const isProng2 = ["prong2", "brief-prong2"].some(k => sectionId.includes(k)) || sectionId.includes("recognition");
  const isProng3 = ["prong3", "brief-prong3"].some(k => sectionId.includes(k)) || sectionId.includes("waiver");

  // US work plan atoms for Prong 1
  const usPlanData = (endeavor.usPlan ?? {}) as Record<string, unknown>;
  const usPlanInstitution = String(usPlanData.institution ?? "").trim();
  const usPlanCollaborators = Array.isArray(usPlanData.collaborators)
    ? (usPlanData.collaborators as Record<string, unknown>[])
        .filter(c => c.name)
        .map(c => `  - ${c.name}${c.institution ? ` (${c.institution})` : ""}${c.role ? `: ${c.role}` : ""}`)
        .join("\n")
    : "";
  const usPlanMilestones = Array.isArray(usPlanData.milestones)
    ? (usPlanData.milestones as Record<string, unknown>[])
        .filter(m => m.description)
        .map(m => `  - ${m.description}${m.timeline ? ` [${m.timeline}]` : ""}`)
        .join("\n")
    : "";

  const prong1Atoms = isProng1 ? `
PROPOSED_ENDEAVOR: ${proposedEndeavor}
NSTC_CATEGORIES: ${nstcCategories}
FEDERAL_PROGRAMS:${federalPrograms ? `\n  ${federalPrograms}` : " none"}
BROAD_DISSEMINATION: ${broadDissemination}${publications ? `\nFUNDING (grants):\n${(qualifications.grants as Record<string, unknown>[] | undefined ?? []).map(g => `  - ${g.title ?? ""}${g.agency ? ` — ${g.agency}` : ""}${g.amount ? ` (${g.amount})` : ""}`).join("\n")}` : ""}${usPlanInstitution ? `\nUS_PLAN_INSTITUTION: ${usPlanInstitution}` : ""}${usPlanCollaborators ? `\nUS_COLLABORATORS:\n${usPlanCollaborators}` : ""}${usPlanMilestones ? `\nMILESTONES:\n${usPlanMilestones}` : ""}` : "";

  const prong2Atoms = isProng2 ? `
PUBLICATIONS:
${publications || "  (none)"}
NOTABLE_CITATIONS:
${notableCitations || "  (none)"}
PEER_REVIEW_ROLES: ${peerReviewCount}
GOVERNMENTAL_RL: ${governmentalRl ? `${governmentalRl.recommender.name ?? ""}, ${governmentalRl.recommender.institution ?? ""}` : "none"}` : "";

  const prong3Atoms = isProng3 ? `
PROPOSED_ENDEAVOR: ${proposedEndeavor}
NSTC_CATEGORIES: ${nstcCategories}
URGENCY_SOURCES:${federalPrograms ? `\n  ${federalPrograms}` : " none"}` : "";

  const evidenceAtoms = [prong1Atoms, prong2Atoms, prong3Atoms].filter(Boolean).join("");

  // Pass already-drafted sections so the model can maintain continuity and avoid repetition.
  // Prefer client-sent live excerpts (from draft-all flow) over stale formData reads.
  let priorContext: string;
  if (previousDraftExcerpts.length > 0) {
    priorContext = previousDraftExcerpts
      .map(e => `### ${e.heading}\n${e.excerpt}…`)
      .join("\n\n");
  } else {
    const narrativeDrafts = (c.formData.narrativeDrafts ?? {}) as Record<string, unknown>;
    const existingSections = (narrativeDrafts[narrativeId] ?? {}) as Record<string, string>;
    priorContext = narrative.outline
      .filter((o) => o.id !== sectionId && existingSections[o.id])
      .map((o) => `### ${o.heading}\n${existingSections[o.id]}`)
      .join("\n\n");
  }

  // Load section-specific guide from guides/{formId}.md
  let sectionGuide = "";
  try {
    const guidePath = join(process.cwd(), "guides", `${c.formId}.md`);
    const fullGuide = await readFile(guidePath, "utf-8");
    const marker = `<!-- SECTION: brief-${sectionId} -->`;
    const startIdx = fullGuide.indexOf(marker);
    if (startIdx !== -1) {
      const contentStart = startIdx + marker.length;
      const endIdx = fullGuide.indexOf("<!-- /SECTION -->", contentStart);
      sectionGuide = endIdx !== -1
        ? fullGuide.slice(contentStart, endIdx).trim()
        : fullGuide.slice(contentStart).trim();
    }
  } catch { /* guide file missing — fall back gracefully */ }

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const tempHeader = req.headers.get("x-llm-temperature");
  const temperature = tempHeader ? parseFloat(tempHeader) : 0.7;

  const llmOpts: LlmOptions = {
    model: modelHeader,
    temperature,
    maxTokens: 1024,
    signal: req.signal,
    usageContext: { caseId: c.id, route: "brief/section" },
  };

  const fixBlock = issueContext
    ? `MANDATORY FIXES — you MUST address every one of these in the new draft. Do not reproduce the same mistakes:
${issueContext}

`
    : "";

  const governmentalRlInstruction = governmentalRl && isProng1
    ? `\n- GOVERNMENTAL_RL is present (${governmentalRl.recommender.name}, ${governmentalRl.recommender.institution}): include a dedicated paragraph in Prong 1 — open with the agency's mission, connect it to the petitioner's work, and state why a federal agency's direct interest proves national importance. Do not relegate this only to Prong 2.`
    : "";
  const nstcInstruction = nstcCategories !== "none" && isProng1
    ? `\n- NSTC_CATEGORIES is set: include the NSTC anchor — "The [field] directly aligns with the [category] category of the 2024 NSTC Critical and Emerging Technologies list, which USCIS Policy Manual Vol. 6 expressly recognizes as a basis for national importance."`
    : "";
  const broadDisseminationInstruction = broadDissemination && isProng2
    ? `\n- BROAD_DISSEMINATION is true: include one sentence noting that peer-reviewed publication ensures benefits of this research are accessible to all stakeholders across academia, industry, and government — not confined to one institution or employer.`
    : "";
  const esiInstruction = isProng2 && publications.includes("ESI")
    ? `\n- ESI citation percentile is provided: use the formula "Applicant's [paper title] is cited at the [percentile]th percentile in its ESI field, compared to a field average of [esiFieldAverage] citations — meaning the work receives [X]× the average attention for papers of its age."`
    : "";

  // Section-specific conditional instructions built separately so they can be
  // appended at the end of the user message (recency bias keeps them fresh).
  const conditionalInstructions = [
    governmentalRlInstruction,
    nstcInstruction,
    broadDisseminationInstruction,
    esiInstruction,
  ].filter(Boolean).join("");

  // Attorney drafting rules — the brief workspace must honor firm standards too.
  // v1 injects global + all petition section rules as guidance (the editor's
  // petition section IDs don't share a namespace with the form outline IDs;
  // section-precise matching is tracked as T5).
  const attorneyGuidance = await resolveDraftingGuidance(session, c, { isPetition: true, sectionId });

  const system = `You are a senior immigration attorney drafting an EB-2 NIW petition brief under Dhanasar. Rules:
- Body text only. No heading, no preamble, no "Section X:" label
- First person ("I have...", "My research...")
- Specific facts only — cite names, metrics, years from the evidence list
- If a claim has no evidence support, write [CITE needed]
- Mix short and long sentences deliberately${issueContext ? "\n- This is a targeted fix — the MANDATORY FIXES block above overrides everything else" : ""}${attorneyGuidance ? `\n\n---\nATTORNEY FIRM RULES (apply throughout):\n\n${attorneyGuidance}\n---` : ""}`;

  // Negative constraints at the VERY END of the user message so they remain
  // fresh in the model's attention window immediately before generation.
  const negativeConstraints = `\n${bannedWordsBlock(conditionalInstructions)}`;

  const user = `${fixBlock}SECTION: ${section.heading}

PETITIONER: ${fullName}
FIELD: ${String(endeavor.endeavorField ?? "their field")}
ENDEAVOR: ${String(endeavor.endeavorStatement ?? "(not specified)")}
NATIONAL IMPORTANCE: ${String((endeavor as Record<string, unknown>).nationalImportanceArgument ?? "(not specified)")}
${ledgerProse ? `\nEVIDENCE LEDGER (neutral third-person facts — use these for precision):\n${ledgerProse}\n` : ""}${evidenceAtoms}
EVIDENCE:
${evidenceText}
${sectionGuide ? `\nSECTION GUIDANCE (follow these instructions):\n${sectionGuide}` : `\nGUIDANCE: ${section.guidance}`}
${priorContext ? `\nALREADY DRAFTED (do not repeat these points):\n${priorContext}` : ""}
${negativeConstraints}

Write the section now. Body text only, no heading.`;

  logger.log(`[brief] ${c.formId} / ${narrativeId} / ${sectionId} — model: ${modelHeader ?? "auto"}`);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const push = (obj: unknown) => controller.enqueue(enc.encode(sse(obj)));
      try {
        let fullText = "";
        for await (const chunk of completeStream(
          [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          llmOpts
        )) {
          fullText += chunk;
          push({ t: "c", v: chunk });
        }
        if (!fullText.trim()) {
          logger.error(`[brief] model returned empty response for ${sectionId}`);
          push({ t: "error", m: "Model returned no content. The model may need more VRAM or the prompt may be too long. Try a larger model or reduce evidence entries." });
        } else {
          logger.log(`[brief] ${sectionId} done — ${fullText.split(/\s+/).filter(Boolean).length} words`);
          push({ t: "done", text: fullText });
          const recommenders = Object.values(c.letters ?? {})
            .map((l) => l.recommender)
            .filter(Boolean);
          const uploadedDocs = Object.entries(c.documents ?? {})
            .filter(([, doc]) => doc.pastedText?.trim())
            .map(([reqId, doc]) => ({ name: reqId, content: doc.pastedText! }));
          const rawFlags = await runGroundingCheck(fullText, {
            qualifications,
            endeavor: (c.formData.endeavor ?? {}) as Record<string, unknown>,
            recommenders,
            documents: uploadedDocs.length ? uploadedDocs : undefined,
          });
          const groundingFlags = resolveOffsets(rawFlags, fullText);
          if (groundingFlags.length) {
            push({ t: "grounding", flags: groundingFlags });
            // Persist per-section grounding flags so they survive page reload
            const existingGrounding = (c.formData.groundingFlags ?? {}) as Record<string, unknown>;
            const narrativeGrounding = (existingGrounding[narrativeId] ?? {}) as Record<string, unknown>;
            patchFormData(c.id, {
              groundingFlags: {
                ...existingGrounding,
                [narrativeId]: { ...narrativeGrounding, [sectionId]: groundingFlags },
              },
            }).catch(() => {});
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`[brief] stream error for ${sectionId}:`, msg);
        push({ t: "error", m: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
