import { NextRequest, NextResponse } from "next/server";
import { completeStructured, type LlmOptions } from "@/lib/lmstudio";
import { tierFor, TIER_META, TIER_THRESHOLDS, evidenceCeiling, scoreFromDimensions } from "@/lib/scoring";
import { isPlausibleResearchField } from "@/lib/checkValidation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type CheckAnswers = {
  degree: string;
  field: string;
  institution: string;
  institutionRorId: string;
  yearsExperience: string;
  publications: string;
  citations: string;
  role: string;
  patents: string;
  awards: string;
  grants: string;
  peerReview: string;
  invitedTalks: string;
  nationalConnection: string;
  usPlan: string;
  employerSituation: string;
};

export type GapNarrative = {
  strengths: string[];
  blockers: string[];
  legalLeverage: string[];
};

export type CheckResult = {
  score: number;
  tier: string;
  eb2Path: "advanced-degree" | "exceptional-ability" | "unclear";
  summary: string;
  dimensions: { label: string; score: number; notes: string }[];
  gaps: { title: string; description: string; priority: "critical" | "important" | "consider" }[];
  gapNarrative: GapNarrative;
  readyToApply: boolean;
};

export async function POST(req: NextRequest) {
  let parsed: CheckAnswers & { turnstileToken?: string };
  try {
    parsed = await (await import("@/lib/body-limit")).parseJsonBody<CheckAnswers & { turnstileToken?: string }>(req, 16_384);
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const { verifyTurnstile } = await import("@/lib/turnstile");
  if (!(await verifyTurnstile(parsed.turnstileToken, ip))) {
    return NextResponse.json({ error: "CAPTCHA verification failed." }, { status: 403 });
  }

  const { turnstileToken: _, ...answers } = parsed;

  // G-3: reject garbage field-of-expertise ("18", "2", "cpu") server-side too —
  // the client wizard gates this, so this is defense-in-depth against direct calls.
  if (!isPlausibleResearchField(answers.field)) {
    return NextResponse.json({ error: "Please enter a valid field of expertise." }, { status: 400 });
  }

  const { trackFunnel } = await import("@/lib/funnel");
  trackFunnel({ event: "check.started", props: { field: answers.field } });

  // temperature:0 for scoring determinism — the same profile must not drift
  // between assessments (was 0.2 → produced 75/72/73 for one profile). The LLM
  // wrapper uses `?? 0.7`, so 0 is honored. The tier/band
  // display change (hiding residual sub-band jitter) is deferred.
  // Cost tracking: the public /check route is unauthenticated, so this is our
  // main LLM cost-abuse surface — record every call to LlmUsage (route only;
  // no lead/case exists yet at funnel time).
  const llmOpts: LlmOptions = { tier: "fast", temperature: 0, maxTokens: 2000, usageContext: { route: "check" } };

  const deepFields = [answers.patents, answers.awards, answers.grants, answers.peerReview, answers.invitedTalks, answers.nationalConnection, answers.usPlan, answers.employerSituation];
  const isPreliminary = deepFields.every((v) => !v || !v.trim());

  const system = `You are a senior immigration attorney with 20+ years of NIW (EB-2 National Interest Waiver) experience. Assess an applicant's eligibility based on their self-reported profile. Return ONLY valid JSON:
{
  "score": number (0-100, overall NIW petition strength),
  "tier": "Strong" | "Developing" | "Early",
  "eb2Path": "advanced-degree" | "exceptional-ability" | "unclear",
  "summary": string (2-3 sentences, plain English, ${isPreliminary ? "encouraging and focused on what IS strong about this profile" : "honest assessment"}),
  "dimensions": [
    { "label": "EB-2 Baseline", "score": number, "notes": string },
    { "label": "Prong 1 — Substantial Merit", "score": number, "notes": string },
    { "label": "Prong 1 — National Importance", "score": number, "notes": string },
    { "label": "Prong 2 — Well Positioned", "score": number, "notes": string },
    { "label": "Prong 3 — Waiver Justified", "score": number, "notes": string }
  ],
  "gaps": [
    { "title": string, "description": string, "priority": "critical" | "important" | "consider" }
  ],
  "gapNarrative": {
    "strengths": [string] (2-3 bullets: what is already strong in this profile — be specific, cite their actual credentials),
    "blockers": [string] (1-3 bullets: what could sink the petition if not addressed — only real issues, not generic advice),
    "legalLeverage": [string] (1-2 bullets: specific legal angles an attorney could use to strengthen this case)
  },
  "readyToApply": boolean
}

${isPreliminary ? `IMPORTANT — PRELIMINARY ASSESSMENT MODE:
This applicant has answered only the first 5 questions (degree, field, experience, publications, citations). Every field marked "(not yet answered)" has NOT been collected. You MUST:
- The 5 answered fields are KNOWN, real data — score them at face value. ONLY fields marked "(not yet answered)" get median assumptions.
- For fields marked "(not yet answered)", assume MEDIAN values typical for this degree and publication record — do NOT assume zero, and do NOT mark them as critical gaps.
- Publications and citations ARE answered. If publications is "None" or citations is "None or unknown", that is real, scored data — Prong 1 Merit MUST reflect it honestly (low). Never inflate an empty research record.
- A PhD with 10+ peer-reviewed publications is objectively a strong NIW candidate — score accordingly (70+). A PhD with 25+ publications and 200+ citations is elite — score 80+.
- BUT a profile with NO publications AND NO/unknown citations has NOT yet demonstrated the impact a National Interest Waiver requires. That is an EARLY-stage profile, not a strong one: Prong 1 Merit <= 30 and the overall picture is "Early", regardless of the degree. Do not present an empty research record as Strong.
- Summary: encouraging where the evidence warrants it, but honest. If research output is absent, name it plainly as the key next step — do not manufacture strength.
- Do NOT penalize for missing US plan, awards, grants, or employer info — those questions haven't been asked yet.
` : ''}Scoring guide (FOLLOW THESE STRICTLY — do not deviate):
- EB-2 Baseline: PhD in STEM → 90+. Master's in specialty → 80. Multiple exceptional ability criteria → 70+. No qualifying degree → 20.
- Prong 1 Merit: 10+ publications = 75 minimum. 50+ citations = 80+. 200+ citations = 90+. $100K+ grant = add 5 points. Peer review roles = add 5 points. 25+ publications = 85+. No publications = 30 max.
- Prong 1 Importance: ${isPreliminary ? "If not yet answered, assume median (65) — do not penalize." : "Named federal program or specific agency priority with evidence = 80+. Named priority without specifics = 70. Vague national benefit = 50. No connection stated = 30."}
- Prong 2: PhD + 10+ publications = 70 minimum. Add: grants (+5), awards (+5), peer review (+5), invited talks (+5), concrete US plan (+10). ${isPreliminary ? "For unanswered fields, assume median." : "Missing US plan → cap at 65."}
- Prong 3: ${isPreliminary ? "If employer not yet answered, assume neutral (65)." : "No employer / self-directed with independent funding = 80+. No employer but no independent funding = 70. Has employer who could sponsor = 50. Employer actively sponsoring = 30."}

gaps: list up to 4 most important gaps in priority order. Be specific and actionable.
readyToApply: ${isPreliminary ? "false (preliminary — full profile needed)" : "true only when score >= 70 and no critical gaps"}.`;

  const formatField = (val: string, label: string) =>
    val && val.trim() ? val : `(not yet answered)`;

  const user = `Applicant profile:

Degree: ${answers.degree}
Field: ${answers.field}
Experience: ${answers.yearsExperience} years

Publications: ${answers.publications}
Total citations: ${answers.citations}
Patents: ${formatField(answers.patents, "Patents")}

Awards: ${formatField(answers.awards, "Awards")}
Grants: ${formatField(answers.grants, "Grants")}
Peer review / editorial: ${formatField(answers.peerReview, "Peer review")}
Invited talks: ${formatField(answers.invitedTalks, "Invited talks")}

National importance connection: ${formatField(answers.nationalConnection, "National importance")}
US plan: ${formatField(answers.usPlan, "US plan")}
Employer situation: ${formatField(answers.employerSituation, "Employer situation")}

${isPreliminary ? "This is a PRELIMINARY assessment — only 5 questions have been answered. Score based on available data only. Be encouraging." : "Assess this applicant's full NIW eligibility."} Return only JSON.`;

  try {
    const result = await completeStructured<CheckResult>(
      [{ role: "system", content: system }, { role: "user", content: user }],
      llmOpts
    );

    // Derive score deterministically from dimensions — never trust LLM's overall
    // score. Single source of truth: lib/scoring.ts → scoreFromDimensions.
    const computed = scoreFromDimensions(result.dimensions);
    if (computed !== null) {
      result.score = computed;
    }

    // Deterministic anti-inflation guard. Clamp to the ceiling supported by the
    // applicant's hard self-reported output. An empty/fake profile (no papers,
    // no citations) can never present as Strong, no matter how "encouraging"
    // the LLM was told to be. Rules over LLM. See lib/scoring.ts → evidenceCeiling.
    const ceiling = evidenceCeiling(answers);
    if (typeof result.score === "number" && result.score > ceiling) {
      result.score = ceiling;
    }

    // Derive tier from computed score
    const canonical = tierFor(result.score);
    result.tier = TIER_META[canonical].label;
    result.readyToApply = !isPreliminary && result.score >= TIER_THRESHOLDS.developing &&
      !result.gaps?.some((g) => g.priority === "critical");

    trackFunnel({ event: "check.completed", props: { score: result.score, tier: result.tier, isPreliminary } });

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
