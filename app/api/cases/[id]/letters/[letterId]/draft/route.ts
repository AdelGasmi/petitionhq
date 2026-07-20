import { NextRequest, NextResponse } from "next/server";
import { readCase, upsertLetter, newId, type LetterVersion } from "@/lib/db";
import { draftLetter, extractEvidence, type ApplicantProfile } from "@/lib/drafting";
import { getForm } from "@/forms";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import { logActivity } from "@/lib/activity";
import { runGroundingCheck } from "@/lib/groundingCheck";
import { prisma } from "@/lib/prisma";
import { resolveDraftingGuidance } from "@/lib/attorneyRules";
import { readFile } from "fs/promises";
import { join } from "path";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes for slow local models


export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "case not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = getForm(c.formId);
  if (!form) return NextResponse.json({ error: "form not found" }, { status: 404 });

  const existing = c.letters[letterId];
  if (!existing) return NextResponse.json({ error: "letter not found" }, { status: 404 });

  // Pricing-V2: no per-applicant letter cap — applicants are free.
  // Self-serve beta drafting is metered per-case (LlmUsage cost total) to bound free-tier spend.
  if (session.role === "applicant" && (await betaCostCapReached(id))) {
    return NextResponse.json({ error: BETA_LIMIT_MESSAGE }, { status: 429 });
  }

  const letterReq = form.letters.find((l) => l.id === existing.requirementId);
  if (!letterReq) {
    return NextResponse.json({ error: "letter requirement not found in form config" }, { status: 404 });
  }

  // Pull model prefs from client headers
  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const fastHeader = req.headers.get("x-llm-model-fast") || undefined;
  const tempHeader = req.headers.get("x-llm-temperature");
  const temperature = tempHeader ? parseFloat(tempHeader) : undefined;

  // Petition letters have no recommender — skip name validation for that kind.
  if (letterReq.kind !== "petition-letter") {
    if (!existing.recommender || !existing.recommender.name) {
      return NextResponse.json(
        { error: "Recommender name is required before drafting." },
        { status: 400 }
      );
    }
  }

  // Build evidence atoms and filter to what the recommender saw
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

  // Load the per-form guide and extract only the section for this letter kind.
  // Each guide uses <!-- SECTION: <id> --> ... <!-- /SECTION --> markers.
  // Falling back to the full file if no section marker matches (future-proofing).
  let formGuide: string | undefined;
  try {
    const guidePath = join(process.cwd(), "guides", `${c.formId}.md`);
    const fullGuide = await readFile(guidePath, "utf-8");
    const sectionId = letterReq.id;
    const startMarker = `<!-- SECTION: ${sectionId} -->`;
    const endMarker = `<!-- /SECTION -->`;
    const startIdx = fullGuide.indexOf(startMarker);
    if (startIdx !== -1) {
      const contentStart = startIdx + startMarker.length;
      const endIdx = fullGuide.indexOf(endMarker, contentStart);
      formGuide = endIdx !== -1
        ? fullGuide.slice(contentStart, endIdx).trim()
        : fullGuide.slice(contentStart).trim();
    } else {
      // No section marker — inject the whole guide (smaller guides with single letter type)
      formGuide = fullGuide;
    }
  } catch {
    // Guide missing for this form — drafting still works, just without the extra context.
  }

  // Load drafting rules — the beta owner's own, or the assigned attorney's (shared loader — same on every draft path).
  const additionalGuidance = await resolveDraftingGuidance(session, c, {
    isPetition: letterReq.kind === "petition-letter",
  });

  try {
    const result = await draftLetter({
      letter: letterReq,
      applicant,
      recommender: existing.recommender,
      formGuide,
      additionalGuidance: additionalGuidance || undefined,
      llm: {
        model: modelHeader,
        temperature,
        usageContext: { caseId: id, route: "letter/draft" },
      },
      critiqueLlm: fastHeader
        ? { model: fastHeader, temperature: 0.2, usageContext: { caseId: id, route: "letter/critique" } }
        : { usageContext: { caseId: id, route: "letter/critique" } },
    });

    // Save the new draft as a version and update current
    const version: LetterVersion = {
      id: newId(),
      content: result.content,
      qualityReport: result.qualityReport,
      createdAt: new Date().toISOString(),
      note: "AI draft",
    };

    const updated = {
      ...existing,
      currentDraft: result.content,
      qualityReport: result.qualityReport,
      versions: [...existing.versions, version],
      updatedAt: new Date().toISOString(),
    };
    await upsertLetter(id, updated);
    logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "letter.drafted", detail: existing.recommender?.name });

    const tokenEstimate = Math.ceil(result.content.length / 4);
    prisma.draftUsage.create({
      data: {
        userId: session.userId,
        caseId: id,
        letterId,
        model: req.headers.get("x-llm-model") ?? "default",
        tokens: tokenEstimate,
      },
    }).catch(() => {});

    const recommenders = Object.values(c.letters ?? {})
      .map(l => l.recommender)
      .filter(Boolean);
    const uploadedDocs = Object.entries(c.documents ?? {})
      .filter(([, doc]) => doc.pastedText?.trim())
      .map(([reqId, doc]) => ({ name: reqId, content: doc.pastedText! }));
    const groundingFlags = await runGroundingCheck(result.content, {
      qualifications,
      endeavor: (c.formData.endeavor ?? {}) as Record<string, unknown>,
      recommenders,
      documents: uploadedDocs.length ? uploadedDocs : undefined,
    });

    return NextResponse.json({
      content: result.content,
      wordCount: result.wordCount,
      qualityReport: result.qualityReport,
      groundingFlags,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    logger.error("[draft] failed:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
