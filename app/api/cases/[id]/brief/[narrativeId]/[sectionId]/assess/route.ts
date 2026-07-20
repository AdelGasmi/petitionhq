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

export type SectionAssessment = {
  score: number;
  criteria: { label: string; passed: boolean; notes: string }[];
  issues: { excerpt: string; problem: string; fix: string }[];
  ready: boolean;
};

// Section-specific rubric: criteria + target word range
const SECTION_RUBRICS: Record<string, { criteria: string[]; wordRange: [number, number] }> = {
  intro: {
    criteria: [
      "Petitioner's name and field stated in the opening sentence",
      "Proposed endeavor described in one specific, concrete sentence",
      "All three Dhanasar prongs explicitly previewed (not merely implied)",
      "Matter of Dhanasar, 26 I&N Dec. 884 (AAO 2016) cited by name",
      "No biography-style opening ('I was born...', 'I always dreamed...')",
    ],
    wordRange: [300, 450],
  },
  "petitioner-qualifications": {
    criteria: [
      "EB-2 path explicitly stated: advanced degree (degree, institution, year) OR exceptional ability (≥3 of 6 CFR §204.5(k)(3) criteria)",
      "Each credential cited with specifics — not just 'I have a PhD'",
      "No vague competency claims without supporting evidence",
    ],
    wordRange: [250, 400],
  },
  "prong1-merit": {
    criteria: [
      "Field-level problem or challenge described with technical specificity",
      "Petitioner's specific approach or methodology clearly stated",
      "At least one publication cited by topic/finding with citation count or impact metric",
      "Scientific/technical significance quantified or anchored to field outcomes",
    ],
    wordRange: [500, 800],
  },
  "prong1-importance": {
    criteria: [
      "At least one named federal program, agency priority, or Executive Order cited",
      "National-scale impact stated with concrete data or policy reference",
      "Explicit link drawn between petitioner's work and the named national priority",
      "No unsupported vague language: 'vital', 'crucial', 'essential' without citation",
    ],
    wordRange: [400, 600],
  },
  prong2: {
    criteria: [
      "Education: degree, institution, year cited",
      "Publications / research achievements listed with specifics",
      "Peer recognition present: awards, grants, editorial roles, or invited talks",
      "Concrete US plan: names specific institution, program, collaborator, or funding source",
      "Elements flow: education → achievements → recognition → US plan",
    ],
    wordRange: [700, 1000],
  },
  prong3: {
    criteria: [
      "Impracticality argument: explains why employer-sponsored job offer is structurally infeasible for self-directed research",
      "Urgency argument: time-sensitive national need that cannot wait for the labor certification process",
      "Unique qualifications argument: specific combination of skills only this petitioner possesses",
      "Three arguments are structurally distinct — not blended into one paragraph",
    ],
    wordRange: [400, 600],
  },
  conclusion: {
    criteria: [
      "All three Dhanasar prongs explicitly summarized",
      "Matter of Dhanasar cited by name in the conclusion",
      "Explicit request for approval",
      "No new facts or arguments introduced",
    ],
    wordRange: [200, 300],
  },
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; narrativeId: string; sectionId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, narrativeId, sectionId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canDraftCase(session, c))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.role === "applicant" && (await betaCostCapReached(id)))
    return NextResponse.json({ error: BETA_LIMIT_MESSAGE }, { status: 429 });

  const form = getForm(c.formId);
  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 });

  const narrative = form.narratives?.find((n) => n.id === narrativeId);
  if (!narrative) return NextResponse.json({ error: "Narrative not found" }, { status: 404 });

  const section = narrative.outline.find((s) => s.id === sectionId);
  if (!section) return NextResponse.json({ error: "Section not found" }, { status: 404 });

  const narrativeDrafts = (c.formData.narrativeDrafts ?? {}) as Record<string, unknown>;
  const sectionDrafts = (narrativeDrafts[narrativeId] ?? {}) as Record<string, string>;
  const draft = sectionDrafts[sectionId]?.trim();

  if (!draft) return NextResponse.json({ error: "No draft to assess" }, { status: 400 });

  const rubric = SECTION_RUBRICS[sectionId];
  const criteriaList = rubric
    ? rubric.criteria.map((c, i) => `${i + 1}. ${c}`).join("\n")
    : `Evaluate whether this section effectively argues its point in the NIW petition context.`;
  const wordRange = rubric?.wordRange ?? [200, 800];
  const wc = draft.trim().split(/\s+/).length;
  const wordRangeNote = wc < wordRange[0]
    ? `UNDER target (${wc} words, target ${wordRange[0]}–${wordRange[1]})`
    : wc > wordRange[1]
    ? `OVER target (${wc} words, target ${wordRange[0]}–${wordRange[1]})`
    : `within target (${wc} words)`;

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const llmOpts: LlmOptions = { model: modelHeader, tier: "fast", temperature: 0.2, maxTokens: 1500, usageContext: { caseId: id, route: "brief/section-assess" } };

  // Attorney firm rules (T6) — so the adjudicator persona doesn't penalize a
  // section for following the firm's required house style. Section-precise:
  // global + the rule matched to this outline section (or global only when the
  // section has no mapped rule). Empty string when the firm has no rules ⇒ no-op.
  const attorneyRules = await resolveDraftingGuidance(session, c, { isPetition: true, sectionId });

  const system = `You are a senior USCIS adjudicator assessing one section of an EB-2 NIW petition brief. Return ONLY valid JSON matching this exact schema:
{
  "score": number (0-100),
  "criteria": [
    { "label": string, "passed": boolean, "notes": string }
  ],
  "issues": [
    { "excerpt": string (first ~100 chars of the problematic passage), "problem": string (what's wrong), "fix": string (specific actionable instruction to fix it) }
  ],
  "ready": boolean
}

rules:
- criteria: evaluate EACH numbered criterion below, one object per criterion, same order
- issues: only include passages that materially weaken the argument — max 3 issues
- fix: must be a concrete instruction the writer can act on immediately ("Add the specific grant amount and agency name", not "Be more specific")
- ready: true only when score >= 78 AND all must-pass criteria are passed
- excerpt: quote the first 80-100 characters of the specific problematic text so the writer can find it`;

  const user = `SECTION: ${section.heading}
WORD COUNT: ${wordRangeNote}

CRITERIA TO EVALUATE (assess each in order):
${criteriaList}

<section_text>
${draft}
</section_text>
${attorneyRulesAssessmentBlock(attorneyRules)}

Assess this section strictly. Return only JSON.`;

  try {
    const assessment = await completeStructured<SectionAssessment>(
      [{ role: "system", content: system }, { role: "user", content: user }],
      llmOpts
    );

    // Persist
    const existing = ((c.formData.sectionAssessments ?? {}) as Record<string, unknown>);
    const existingNarrative = ((existing[narrativeId] ?? {}) as Record<string, unknown>);
    await patchFormData(id, {
      sectionAssessments: {
        ...existing,
        [narrativeId]: { ...existingNarrative, [sectionId]: assessment },
      },
    });

    return NextResponse.json(assessment);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
