import { NextRequest, NextResponse } from "next/server";
import { readCase, upsertLetter, newId, type LetterVersion, type QualityReport } from "@/lib/db";
import {
  regenerateSection,
  type DraftRequest,
  type ApplicantProfile,
} from "@/lib/drafting";
import { completeStructured, type LlmOptions } from "@/lib/lmstudio";
import { getForm } from "@/forms";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import { resolveDraftingGuidance } from "@/lib/attorneyRules";
import { CRITIQUE_SYSTEM, critiqueUser as buildCritiqueUser } from "@/lib/prompts/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const body = (await req.json()) as { paragraph: string; issue: string };

  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.role === "applicant" && (await betaCostCapReached(id)))
    return NextResponse.json({ error: BETA_LIMIT_MESSAGE }, { status: 429 });

  const form = getForm(c.formId);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const existing = c.letters[letterId];
  if (!existing) return NextResponse.json({ error: "letter not found" }, { status: 404 });

  if (!existing.currentDraft) {
    return NextResponse.json({ error: "no draft to regenerate from" }, { status: 400 });
  }

  const letterReq = form.letters.find((l) => l.id === existing.requirementId);
  if (!letterReq) {
    return NextResponse.json(
      { error: "letter requirement not found in form config" },
      { status: 404 }
    );
  }

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const tempHeader = req.headers.get("x-llm-temperature");
  const temperature = tempHeader ? parseFloat(tempHeader) : undefined;

  const petitionerInfo = (c.formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const endeavor = (c.formData.endeavor ?? {}) as Record<string, unknown>;

  const qualifications = (c.formData.qualifications ?? {}) as Record<string, unknown>;

  const applicant: ApplicantProfile = {
    name: String(petitionerInfo.fullName ?? "The applicant"),
    field: String(endeavor.endeavorField ?? "their field"),
    endeavor: String(endeavor.endeavorStatement ?? ""),
    highlightedEvidence: [],
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

  const additionalGuidance = await resolveDraftingGuidance(session, c, {
    isPetition: letterReq.kind === "petition-letter",
  });

  const draftReq: DraftRequest = {
    letter: letterReq,
    applicant,
    recommender: existing.recommender,
    additionalGuidance: additionalGuidance || undefined,
    llm: { model: modelHeader, temperature, usageContext: { caseId: id, route: "letter/regenerate" } },
  };

  try {
    const newParagraph = await regenerateSection(
      existing.currentDraft,
      body.paragraph,
      body.issue,
      draftReq
    );

    const updatedDraft = existing.currentDraft.replace(body.paragraph, newParagraph);

    // Re-run critique on the updated full letter so quality scores stay fresh.
    const mustAddress = letterReq.draftingHints?.mustAddress ?? [];
    const critiqueSystem = CRITIQUE_SYSTEM;
    const critiqueUser = buildCritiqueUser(updatedDraft, mustAddress);

    const critiqueOpts: LlmOptions = { temperature: 0.2, maxTokens: 2000, tier: "fast" };
    let qualityReport: QualityReport;
    try {
      qualityReport = await completeStructured<QualityReport>(
        [{ role: "system", content: critiqueSystem }, { role: "user", content: critiqueUser }],
        critiqueOpts
      );
    } catch {
      qualityReport = existing.qualityReport ?? {
        overallScore: 0,
        dimensions: { specificity: { score: 0, notes: "Critique unavailable" }, evidentiarySupport: { score: 0, notes: "" }, voiceAuthenticity: { score: 0, notes: "" }, frameworkCoverage: { score: 0, notes: "" }, aiSlopFreeness: { score: 0, notes: "" } },
        weakParagraphs: [],
        strengths: [],
        readyToSend: false,
      };
    }

    const version: LetterVersion = {
      id: newId(),
      content: updatedDraft,
      qualityReport,
      createdAt: new Date().toISOString(),
      note: "paragraph regenerated",
    };

    const updated = {
      ...existing,
      currentDraft: updatedDraft,
      qualityReport,
      versions: [...existing.versions, version],
      updatedAt: new Date().toISOString(),
    };
    await upsertLetter(id, updated);

    return NextResponse.json({ letter: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
