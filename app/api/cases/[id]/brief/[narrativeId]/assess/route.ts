import { NextRequest, NextResponse } from "next/server";
import { readCase, patchFormData } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import { getForm } from "@/forms";
import { completeStructured, type LlmOptions } from "@/lib/lmstudio";
import { resolveDraftingGuidance } from "@/lib/attorneyRules";
import { attorneyRulesAssessmentBlock } from "@/lib/prompts/constants";
import type { QualityReport } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function assembleBrief(outline: { id: string; heading: string }[], drafts: Record<string, string>): string {
  return outline
    .filter((s) => drafts[s.id]?.trim())
    .map((s) => `${s.heading.toUpperCase()}\n\n${drafts[s.id].trim()}`)
    .join("\n\n\n");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; narrativeId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, narrativeId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canDraftCase(session, c))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.role === "applicant" && (await betaCostCapReached(id)))
    return NextResponse.json({ error: BETA_LIMIT_MESSAGE }, { status: 429 });

  const form = getForm(c.formId);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const narrative = form.narratives?.find((n) => n.id === narrativeId);
  if (!narrative) return NextResponse.json({ error: "Narrative not found" }, { status: 404 });

  const narrativeDrafts = (c.formData.narrativeDrafts ?? {}) as Record<string, unknown>;
  const sectionDrafts = (narrativeDrafts[narrativeId] ?? {}) as Record<string, string>;
  const fullBrief = assembleBrief(narrative.outline, sectionDrafts);

  if (!fullBrief.trim()) {
    return NextResponse.json({ error: "No drafted content to assess" }, { status: 400 });
  }

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const llmOpts: LlmOptions = {
    model: modelHeader,
    tier: "fast",
    temperature: 0.2,
    maxTokens: 2000,
    usageContext: { caseId: id, route: "brief/assess" },
  };

  // Attorney firm rules (T6) — global + ALL petition section rules (no sectionId)
  // so the whole-brief adjudicator doesn't penalize firm-mandated house style.
  // Empty string when the firm has no rules ⇒ no behavior change.
  const attorneyRules = await resolveDraftingGuidance(session, c, { isPetition: true });

  const system = `You are a senior USCIS adjudicator with 20+ years of NIW petition experience. Assess the brief strictly and return ONLY valid JSON in this exact shape:
{
  "overallScore": number (0-100),
  "dimensions": {
    "eb2Baseline":      { "score": number, "notes": string },
    "prong1Merit":      { "score": number, "notes": string },
    "prong1Importance": { "score": number, "notes": string },
    "prong2Positioning":{ "score": number, "notes": string },
    "prong3Waiver":     { "score": number, "notes": string },
    "specificity":      { "score": number, "notes": string },
    "aiSlopFreeness":   { "score": number, "notes": string }
  },
  "weakParagraphs": [{ "paragraph": string, "issue": string }],
  "strengths": [string],
  "readyToSend": boolean
}

Scoring rubric:
- eb2Baseline: advanced degree or exceptional ability clearly established with credentials?
- prong1Merit: does the brief argue substantial merit of the proposed endeavor with field-specific reasoning?
- prong1Importance: does it cite specific federal programs, agency priorities, or national data — not just vague "important to the US"?
- prong2Positioning: education, publications, awards, grants, peer recognition, and a concrete US plan all present?
- prong3Waiver: three distinct arguments — impracticality of job offer, urgency, unique qualifications?
- specificity: are claims backed by paper titles, citation counts, dollar amounts, named programs? No vague generalities?
- aiSlopFreeness: free of "testament to", "paradigm shift", "delve into", "groundbreaking", "notably", em-dash abuse?

readyToSend = true only when overallScore >= 80 AND all dimension scores >= 70.
weakParagraphs: up to 5 most problematic passages (quote the first 120 chars, state the specific issue).`;

  const user = `<brief>\n${fullBrief}\n</brief>${attorneyRulesAssessmentBlock(attorneyRules)}\n\nAssess this NIW petition brief. Return only JSON.`;

  try {
    const report = await completeStructured<QualityReport>([
      { role: "system", content: system },
      { role: "user", content: user },
    ], llmOpts);

    // Persist alongside the narrative drafts
    const existing = ((c.formData.briefQualityReports ?? {}) as Record<string, unknown>);
    await patchFormData(id, {
      briefQualityReports: { ...existing, [narrativeId]: report },
    });

    return NextResponse.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
