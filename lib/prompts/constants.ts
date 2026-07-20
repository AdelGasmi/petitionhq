/**
 * Shared prompt constants — single source of truth for instruction blocks that
 * were previously copy-pasted across drafting + routes.
 *
 * Why this exists: the banned-words block lived in 2 places and the letter
 * critique rubric in 3, and the copies had already drifted (the streaming /
 * regenerate critique was a shorter, different variant than the canonical one).
 * That means output quality depended on which button the user clicked. Keep
 * every shared block here and interpolate it; never re-inline.
 */

/**
 * House-style negative constraints. Union of the two former copies (letters +
 * brief sections). `extra` is appended inside the block before the closing tag
 * — the brief route uses it for section-specific conditional instructions.
 */
export function bannedWordsBlock(extra = ""): string {
  return `<negative_constraints>
BANNED WORDS/PATTERNS — never use these:
- "testament to", "paradigm shift", "not only...but also", "in conclusion"
- "delve into", "navigate the complexities", "groundbreaking"
- Em-dash (—) used more than once per paragraph
- List-of-three rhythm ("skilled, talented, and dedicated")
- Weasel hedges: "arguably", "notably", "seemingly", "it could be said"${extra}
</negative_constraints>`;
}

/**
 * Canonical letter-critique system prompt (the rich version that was only in
 * lib/drafting.ts; the streaming + regenerate paths used a thinner copy).
 */
export const CRITIQUE_SYSTEM = `You are a senior USCIS adjudicator reviewing a recommendation letter. You grade letters against a professional rubric. You are BLUNT and SPECIFIC. Generic praise is useless — the drafter needs actionable feedback.

Return ONLY valid JSON:

{
  "overallScore": number (0-100),
  "dimensions": {
    "specificity": { "score": number, "notes": string },
    "evidentiarySupport": { "score": number, "notes": string },
    "voiceAuthenticity": { "score": number, "notes": string },
    "frameworkCoverage": { "score": number, "notes": string },
    "aiSlopFreeness": { "score": number, "notes": string }
  },
  "weakParagraphs": [ { "paragraph": "exact text from the letter", "issue": "what's wrong" } ],
  "strengths": ["..."],
  "readyToSend": boolean
}

Scoring: 90-100 = professional. 75-89 = solid, minor polish. 60-74 = usable but notable weaknesses. <60 = major rework.
readyToSend = true only if overallScore >= 85 AND aiSlopFreeness >= 80.`;

/** Canonical letter-critique user prompt. */
export function critiqueUser(letter: string, mustAddress: string[]): string {
  return `RUBRIC
- specificity: Does every claim have concrete detail (names, dates, metrics, projects)?
- evidentiarySupport: Can each claim be tied to the evidence list?
- voiceAuthenticity: Does this sound like the real recommender wrote it, not an LLM?
- frameworkCoverage: Does it address each required topic? Required: ${JSON.stringify(mustAddress)}
- aiSlopFreeness: Free of "testament to", "paradigm shift", "not only...but also", "in conclusion", em-dash abuse, rule-of-three rhythm, generic praise, "delve into", "navigate the complexities"?

<letter>
${letter}
</letter>`;
}

/**
 * Wrap an attorney's flattened firm rules (the string from
 * `loadAttorneyGuidance`) for injection into an **assessment** prompt.
 *
 * Why this exists: the assessment personas ("senior USCIS adjudicator" / "senior
 * immigration attorney") grade against generic best practice and will otherwise
 * penalize a draft for following the firm's house style — a mandated voice,
 * structure, or required phrase reads to them as "unnatural" or "irrelevant".
 * This block tells the evaluator that adherence to the firm rules is intentional
 * and must NOT be scored as a defect, while leaving the substantive
 * USCIS/Dhanasar criteria fully in force.
 *
 * Returns `""` when the attorney has no rules configured (or on a load error),
 * so assessment behavior is **unchanged** for firms without custom rules. See
 * master_instructions §6.
 */
export function attorneyRulesAssessmentBlock(rules: string | null | undefined): string {
  if (!rules || !rules.trim()) return "";
  return `

FIRM CUSTOM DRAFTING RULES (grading context — not a defect):
The drafting attorney explicitly required the firm-specific rules below for this
document. Do NOT lower the score for the text adhering to them — a firm-mandated
voice, structure, or required phrase is intentional, not "unnatural" or off-base.
Treat adherence as expected and correct; keep applying the substantive
USCIS/Dhanasar criteria normally.
<firm_rules>
${rules.trim()}
</firm_rules>`;
}
