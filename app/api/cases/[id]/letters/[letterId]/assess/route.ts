import { NextRequest, NextResponse } from "next/server";
import { readCase, upsertLetter } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { betaCostCapReached, BETA_LIMIT_MESSAGE } from "@/lib/betaLimits";
import { getForm } from "@/forms";
import { completeStructured, type LlmOptions } from "@/lib/lmstudio";
import type { QualityReport } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canDraftCase(session, c))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (session.role === "applicant" && (await betaCostCapReached(id)))
    return NextResponse.json({ error: BETA_LIMIT_MESSAGE }, { status: 429 });

  const letter = c.letters[letterId];
  if (!letter) return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  const draft = letter.currentDraft?.trim();
  if (!draft) return NextResponse.json({ error: "No draft to assess" }, { status: 400 });

  const form = getForm(c.formId);
  const letterReq = form?.letters.find((l) => l.id === letter.requirementId);
  const mustAddress = letterReq?.draftingHints?.mustAddress ?? [];

  const modelHeader = req.headers.get("x-llm-model") || undefined;
  const llmOpts: LlmOptions = {
    model: modelHeader,
    tier: "fast",
    temperature: 0.2,
    maxTokens: 2000,
    usageContext: { caseId: id, route: "letter/assess" },
  };

  const system = `You are a senior USCIS adjudicator reviewing a recommendation letter for an EB-2 NIW petition. Return ONLY valid JSON:
{
  "overallScore": number (0-100),
  "dimensions": {
    "specificity":        { "score": number, "notes": string },
    "evidentiarySupport": { "score": number, "notes": string },
    "voiceAuthenticity":  { "score": number, "notes": string },
    "frameworkCoverage":  { "score": number, "notes": string },
    "aiSlopFreeness":     { "score": number, "notes": string }
  },
  "weakParagraphs": [{ "paragraph": string, "issue": string }],
  "strengths": [string],
  "readyToSend": boolean
}

readyToSend = true only when overallScore >= 85 AND aiSlopFreeness >= 80.
weakParagraphs: up to 5 passages — quote the first 120 chars, state the specific issue.`;

  const user = `RUBRIC
- specificity: concrete facts (names, dates, metrics)?
- evidentiarySupport: claims tied to evidence in the letter?
- voiceAuthenticity: sounds like a real expert, not an LLM?
- frameworkCoverage: covers required topics? Required: ${JSON.stringify(mustAddress)}
- aiSlopFreeness: free of clichés?

<letter>
${draft}
</letter>

Assess this letter. Return only JSON.`;

  try {
    const report = await completeStructured<QualityReport>([
      { role: "system", content: system },
      { role: "user", content: user },
    ], llmOpts);

    const updated = { ...letter, qualityReport: report };
    await upsertLetter(id, updated);

    return NextResponse.json(report);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
