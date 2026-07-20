import { NextRequest, NextResponse } from "next/server";
import { readCase, patchFormData } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import { getForm } from "@/forms";
import { completeStructured, type LlmOptions } from "@/lib/lmstudio";
import { resolveDraftingGuidance } from "@/lib/attorneyRules";
import { attorneyRulesAssessmentBlock } from "@/lib/prompts/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export type CoherenceReport = {
  score: number;
  dimensions: {
    label: string;
    score: number;
    notes: string;
  }[];
  contradictions: { sectionA: string; sectionB: string; issue: string }[];
  transitionIssues: { between: string; issue: string; suggestion: string }[];
  readyToFile: boolean;
};

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

  const assembledSections = narrative.outline
    .filter((s) => sectionDrafts[s.id]?.trim())
    .map((s) => `[${s.heading}]\n${sectionDrafts[s.id].trim()}`);

  if (assembledSections.length < 3) {
    return NextResponse.json({ error: "Draft at least 3 sections before running coherence check" }, { status: 400 });
  }

  const sectionNames = narrative.outline
    .filter((s) => sectionDrafts[s.id]?.trim())
    .map((s) => s.heading);

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const llmOpts: LlmOptions = { model: modelHeader, tier: "fast", temperature: 0.2, maxTokens: 2000, usageContext: { caseId: id, route: "brief/coherence" } };

  // Attorney firm rules (T6) — global + ALL petition section rules so the
  // coherence reviewer (which explicitly scores "Voice Consistency") doesn't
  // mark a firm-mandated voice as inconsistent. Empty ⇒ no behavior change.
  const attorneyRules = await resolveDraftingGuidance(session, c, { isPetition: true });

  const system = `You are a senior immigration attorney reviewing an EB-2 NIW petition brief for coherence and narrative quality. You are reading the sections in sequence. Return ONLY valid JSON:
{
  "score": number (0-100),
  "dimensions": [
    { "label": "Narrative Arc", "score": number, "notes": string },
    { "label": "Voice Consistency", "score": number, "notes": string },
    { "label": "Argument Progression", "score": number, "notes": string },
    { "label": "No Redundancy", "score": number, "notes": string },
    { "label": "Dhanasar Coverage", "score": number, "notes": string }
  ],
  "contradictions": [
    { "sectionA": string, "sectionB": string, "issue": string }
  ],
  "transitionIssues": [
    { "between": string (e.g. "Intro → Prong 1"), "issue": string, "suggestion": string }
  ],
  "readyToFile": boolean
}

Assess:
- Narrative Arc: does the brief tell a coherent story from intro through conclusion?
- Voice Consistency: is the register, formality, and first-person tone consistent throughout — and consistent with any FIRM CUSTOM DRAFTING RULES provided below the brief? A firm-mandated voice is correct, not a defect.
- Argument Progression: does each section build on the previous? Do Prong 1 → 2 → 3 escalate properly?
- No Redundancy: are the same facts or citations used identically in multiple sections without adding new framing?
- Dhanasar Coverage: are all three prongs fully argued across the brief as a whole?

contradictions: only real logical conflicts — a claim in one section that contradicts or undermines a claim in another.
transitionIssues: abrupt shifts, missing connective logic, or sections that feel disconnected.
readyToFile: true only when score >= 80 and no contradictions found.`;

  const user = `Sections present: ${sectionNames.join(", ")}

${assembledSections.join("\n\n---\n\n")}
${attorneyRulesAssessmentBlock(attorneyRules)}

Analyze this petition brief for coherence. Return only JSON.`;

  try {
    const report = await completeStructured<CoherenceReport>(
      [{ role: "system", content: system }, { role: "user", content: user }],
      llmOpts
    );

    await patchFormData(id, {
      coherenceReports: {
        ...((c.formData.coherenceReports ?? {}) as Record<string, unknown>),
        [narrativeId]: report,
      },
    });

    return NextResponse.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
