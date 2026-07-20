import { NextRequest } from "next/server";
import { readCase, upsertLetter, newId, type LetterVersion } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import {
  buildDraftMessages,
  extractEvidence,
  type ApplicantProfile,
  type DraftRequest,
} from "@/lib/drafting";
import { completeStream, completeStructured, type LlmOptions } from "@/lib/lmstudio";
import { getForm } from "@/forms";
import { readFile } from "fs/promises";
import { join } from "path";
import type { QualityReport } from "@/lib/db";
import { runGroundingCheck } from "@/lib/groundingCheck";
import { prisma } from "@/lib/prisma";
import { resolveDraftingGuidance } from "@/lib/attorneyRules";
import { CRITIQUE_SYSTEM, critiqueUser as buildCritiqueUser } from "@/lib/prompts/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 600;


function sse(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return new Response("case not found", { status: 404 });
  if (!(await canDraftCase(session, c)))
    return new Response("Forbidden", { status: 403 });

  const form = getForm(c.formId);
  if (!form) return new Response("form not found", { status: 404 });

  const existing = c.letters[letterId];
  if (!existing) return new Response("letter not found", { status: 404 });

  const letterReq = form.letters.find((l) => l.id === existing.requirementId);
  if (!letterReq) return new Response("letter req not found", { status: 404 });

  if (letterReq.kind !== "petition-letter" && !existing.recommender?.name)
    return new Response("recommender name required", { status: 400 });

  // Pricing-V2: no per-applicant letter cap.
  // Self-serve beta drafting is metered per-case (LlmUsage cost total) to bound free-tier spend.
  if (session.role === "applicant" && (await betaCostCapReached(id))) {
    return new Response(BETA_LIMIT_MESSAGE, { status: 429 });
  }

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const fastHeader  = req.headers.get("x-llm-model-fast") || undefined;
  const tempHeader  = req.headers.get("x-llm-temperature");
  const temperature = tempHeader ? parseFloat(tempHeader) : undefined;

  const allEvidence = extractEvidence(c.formData);
  const selected = existing.selectedEvidence?.length
    ? allEvidence.filter((e) => existing.selectedEvidence.includes(e.id))
    : allEvidence;

  const petitionerInfo = (c.formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const endeavor = (c.formData.endeavor ?? {}) as Record<string, unknown>;

  // Support both old fullName and new split name fields
  const fullName = petitionerInfo.fullName
    ? String(petitionerInfo.fullName)
    : [petitionerInfo.givenName, petitionerInfo.middleName, petitionerInfo.familyName]
        .filter(Boolean).join(" ") || "The applicant";

  const qualifications = (c.formData.qualifications ?? {}) as Record<string, unknown>;

  const applicant: ApplicantProfile = {
    name: fullName,
    field: String(endeavor.endeavorField ?? "their field"),
    endeavor: String(endeavor.endeavorStatement ?? ""),
    highlightedEvidence: selected,
    nstcCategories: Array.isArray(endeavor.nstcCategories) ? endeavor.nstcCategories as string[] : undefined,
    federalPrograms: Array.isArray(endeavor.federalPrograms)
      ? (endeavor.federalPrograms as Record<string, unknown>[])
          .filter(p => p.programName)
          .map(p => ({ programName: String(p.programName), agencyOrOffice: p.agencyOrOffice ? String(p.agencyOrOffice) : undefined, specificGoal: p.specificGoal ? String(p.specificGoal) : undefined }))
      : undefined,
    notableCitations: Array.isArray(qualifications.notableCitations)
      ? (qualifications.notableCitations as Record<string, unknown>[])
          .filter(c => c.citingAuthor || c.citingJournal)
          .map(c => ({ citingAuthor: c.citingAuthor ? String(c.citingAuthor) : undefined, citingJournal: c.citingJournal ? String(c.citingJournal) : undefined, citingYear: typeof c.citingYear === "number" ? c.citingYear : undefined, howUsed: c.howUsed ? String(c.howUsed) : undefined }))
      : undefined,
    researchIsPublished: endeavor.researchIsPublished !== false,
  };

  let formGuide: string | undefined;
  try {
    const guidePath = join(process.cwd(), "guides", `${c.formId}.md`);
    const fullGuide = await readFile(guidePath, "utf-8");
    const startMarker = `<!-- SECTION: ${letterReq.id} -->`;
    const endMarker = `<!-- /SECTION -->`;
    const startIdx = fullGuide.indexOf(startMarker);
    if (startIdx !== -1) {
      const contentStart = startIdx + startMarker.length;
      const endIdx = fullGuide.indexOf(endMarker, contentStart);
      formGuide = endIdx !== -1
        ? fullGuide.slice(contentStart, endIdx).trim()
        : fullGuide.slice(contentStart).trim();
    } else {
      formGuide = fullGuide;
    }
  } catch { /* guide missing — fine */ }

  // Drafting rules — must be applied here too (this is the path the UI
  // actually calls). Previously omitted, which silently dropped firm rules.
  const additionalGuidance = await resolveDraftingGuidance(session, c, {
    isPetition: letterReq.kind === "petition-letter",
  });

  const draftReq: DraftRequest = {
    letter: letterReq,
    applicant,
    recommender: existing.recommender,
    formGuide,
    additionalGuidance: additionalGuidance || undefined,
    llm: { model: modelHeader, temperature },
    critiqueLlm: fastHeader ? { model: fastHeader, temperature: 0.2 } : undefined,
  };

  const llmOpts: LlmOptions = {
    model: modelHeader,
    temperature: temperature ?? 0.7,
    maxTokens: letterReq.kind === "petition-letter" ? 8192 : 3500,
    signal: req.signal,
    usageContext: { caseId: id, route: "letter/draft-stream" },
  };

  const messages = buildDraftMessages(draftReq);

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const push = (obj: unknown) => controller.enqueue(enc.encode(sse(obj)));

      let fullText = "";
      try {
        // ── Phase 1: stream tokens ──────────────────────────────────────────
        push({ t: "phase", v: "generating" });
        for await (const chunk of completeStream(messages, llmOpts)) {
          fullText += chunk;
          push({ t: "c", v: chunk });
        }

        // ── Phase 2: save draft ─────────────────────────────────────────────
        push({ t: "phase", v: "saving" });
        const wordCount = fullText.split(/\s+/).filter(Boolean).length;
        push({ t: "words", v: wordCount });

        // ── Phase 3: critique ───────────────────────────────────────────────
        push({ t: "phase", v: "critiquing" });
        const mustAddress = letterReq.draftingHints?.mustAddress ?? [];
        const critiqueSystem = CRITIQUE_SYSTEM;
        const critiqueUser = buildCritiqueUser(fullText, mustAddress);

        const critiqueOpts: LlmOptions = draftReq.critiqueLlm
          ? { temperature: 0.2, maxTokens: 2000, tier: "fast", ...draftReq.critiqueLlm }
          : { temperature: 0.2, maxTokens: 2000, tier: "fast" };

        let qualityReport: QualityReport;
        try {
          qualityReport = await completeStructured<QualityReport>(
            [{ role: "system", content: critiqueSystem }, { role: "user", content: critiqueUser }],
            critiqueOpts
          );
        } catch {
          qualityReport = {
            overallScore: 0,
            dimensions: { specificity: { score: 0, notes: "Critique unavailable" }, evidentiarySupport: { score: 0, notes: "" }, voiceAuthenticity: { score: 0, notes: "" }, frameworkCoverage: { score: 0, notes: "" }, aiSlopFreeness: { score: 0, notes: "" } },
            weakParagraphs: [],
            strengths: [],
            readyToSend: false,
          };
        }

        // ── Phase 4: persist ────────────────────────────────────────────────
        const version: LetterVersion = {
          id: newId(),
          content: fullText,
          qualityReport,
          createdAt: new Date().toISOString(),
          note: "AI draft",
        };
        const updated = {
          ...existing,
          currentDraft: fullText,
          qualityReport,
          versions: [...(existing.versions ?? []), version],
          updatedAt: new Date().toISOString(),
        };
        await upsertLetter(id, updated);

        const tokenEstimate = Math.ceil(fullText.length / 4);
        prisma.draftUsage.create({
          data: {
            userId: session.userId,
            caseId: id,
            letterId,
            model: modelHeader ?? "default",
            tokens: tokenEstimate,
          },
        }).catch(() => {});

        push({ t: "critique", r: qualityReport, versions: updated.versions });

        // ── Phase 5: grounding check (non-blocking) ─────────────────────────
        const recommenders = Object.values(c.letters ?? {})
          .map(l => l.recommender)
          .filter(Boolean);
        const uploadedDocs = Object.entries(c.documents ?? {})
          .filter(([, doc]) => doc.pastedText?.trim())
          .map(([reqId, doc]) => ({ name: reqId, content: doc.pastedText! }));
        const groundingFlags = await runGroundingCheck(fullText, {
          qualifications,
          endeavor: (c.formData.endeavor ?? {}) as Record<string, unknown>,
          recommenders,
          documents: uploadedDocs.length ? uploadedDocs : undefined,
        });
        if (groundingFlags.length) push({ t: "grounding", flags: groundingFlags });

        // ── Phase 6: persona-drift check (recommendation letters only) ───────
        // Detects sentences where the recommender appears to claim the applicant's
        // work as their own — a hallmark of first-person intake data leaking into
        // the generation context.
        if (letterReq.kind !== "petition-letter") {
          try {
            type PersonaDriftResult = { sentences: string[] };
            const driftResult = await completeStructured<PersonaDriftResult>(
              [
                {
                  role: "system",
                  content: `You are reviewing a recommendation letter for a specific error: the recommender accidentally speaking AS the applicant — claiming the applicant's publications, awards, or research as their own work.

Return ONLY valid JSON: {"sentences": ["exact sentence from the letter", ...]}
If no such sentences exist, return {"sentences": []}

ONLY flag sentences where the recommender uses "I" or "my" to describe the APPLICANT'S specific achievements (e.g. "I published X" when the letter is about someone else, "My research demonstrated Y" when describing the applicant's research). Do NOT flag legitimate recommender self-references like "I have known Dr. X for 5 years" or "I am a professor at Y University".`,
                },
                {
                  role: "user",
                  content: `Recommender name: ${existing.recommender?.name ?? "unknown"}
Applicant name: ${fullName}

<letter>
${fullText}
</letter>`,
                },
              ],
              { tier: "fast", temperature: 0, maxTokens: 500 }
            );
            if (driftResult.sentences?.length) {
              push({ t: "persona_drift", sentences: driftResult.sentences });
            }
          } catch { /* persona check is best-effort */ }
        }

        push({ t: "done" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
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
