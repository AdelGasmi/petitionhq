/**
 * Custom drafting rules — single source for turning either an attorney's
 * `/network/rules` configuration (FirmProfile.draftingRules) or a
 * self-petitioner beta user's own rules (User.draftingRules) into prompt
 * text. Same JSON shape, same flattening logic, two storage locations —
 * applicants don't get a FirmProfile (that model is attorney/billing-
 * specific and /admin/firms lists every row unfiltered by role).
 *
 * Historically this flatten logic lived inline in the blocking letter-draft
 * route, which meant the streaming draft, the brief workspace, and the
 * regenerate path silently ignored attorney rules (a "placebo UI" — the
 * settings saved but never reached the model). Centralizing here lets every
 * generation path inject the same guidance.
 */

import { prisma } from "./prisma";
import type { DraftingRules, SectionRule } from "@/app/api/attorney-rules/route";

/**
 * Crosswalk: petition-brief outline section IDs (forms/*.ts `narratives[].outline[].id`)
 * → the petition-section rule IDs the attorney edits at /network/rules
 * (DraftingRulesEditor PETITION_SECTIONS). The two namespaces differ
 * (`prong1-merit` vs `prong1_merit`), so the brief workspace can't match them
 * by string equality. Outline sections with no dedicated rule section
 * (petitioner-qualifications, conclusion) fall through to global guidance only.
 */
const BRIEF_SECTION_TO_RULE_ID: Record<string, string> = {
  intro: "intro",
  "prong1-merit": "prong1_merit",
  "prong1-importance": "prong1_importance",
  prong2: "prong2",
  prong3: "prong3",
};

/** Map a brief outline section id to its attorney petition-section rule id, if any. */
export function briefSectionRuleId(sectionId: string): string | undefined {
  const normalized = sectionId.replace(/^brief-/, "");
  return BRIEF_SECTION_TO_RULE_ID[normalized];
}

/**
 * Flatten a DraftingRules JSON blob into a guidance block suitable for
 * injection into a drafting prompt. Returns "" when nothing is configured.
 *
 *   isPetition  → selects petitionSections vs letterSections
 *   sectionId   → when set (the brief workspace), inject ONLY the rule matching
 *                 that brief section (via briefSectionRuleId), plus global
 *                 guidance. When unset (letter draft / one-shot petition-letter),
 *                 inject all configured section rules — the long-standing behavior.
 */
function flattenDraftingRules(
  rules: DraftingRules,
  opts: { isPetition: boolean; sectionId?: string }
): string {
  const { isPetition, sectionId } = opts;

  // Section-precise mode (brief workspace): resolve the one matching rule id, or
  // null when this section has no dedicated rule (→ global guidance only).
  const onlyRuleId = sectionId !== undefined ? briefSectionRuleId(sectionId) ?? null : undefined;

  const parts: string[] = [];

  if (rules.globalGuidance?.trim()) {
    parts.push(`GLOBAL DRAFTING RULES:\n${rules.globalGuidance.trim()}`);
  }

  const sectionMap = isPetition ? rules.petitionSections : rules.letterSections;
  if (sectionMap && onlyRuleId !== null) {
    const sectionRules = Object.entries(sectionMap)
      // Section-precise mode keeps only the matching rule; otherwise keep all.
      .filter(([id]) => onlyRuleId === undefined || id === onlyRuleId)
      .filter(([, r]: [string, SectionRule]) => r.instructions?.trim())
      .map(([id, r]: [string, SectionRule]) => {
        const lines = [`  [${id}]: ${r.instructions}`];
        if (r.tone) lines.push(`    Tone: ${r.tone}`);
        if (r.mustInclude?.length) lines.push(`    Must include: ${r.mustInclude.join("; ")}`);
        if (r.avoid?.length) lines.push(`    Avoid: ${r.avoid.join("; ")}`);
        return lines.join("\n");
      });
    if (sectionRules.length) {
      parts.push(`SECTION-SPECIFIC DRAFTING RULES:\n${sectionRules.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Load and flatten an attorney's drafting rules (FirmProfile.draftingRules).
 * Returns "" when the attorney has no rules configured, or on any DB error
 * (best-effort — drafting must never fail because rules couldn't be loaded).
 */
export async function loadAttorneyGuidance(opts: {
  attorneyId: string;
  isPetition: boolean;
  sectionId?: string;
}): Promise<string> {
  try {
    const firm = await prisma.firmProfile.findUnique({
      where: { userId: opts.attorneyId },
      select: { draftingRules: true },
    });
    if (!firm?.draftingRules) return "";
    return flattenDraftingRules(firm.draftingRules as DraftingRules, opts);
  } catch {
    return "";
  }
}

/**
 * Load and flatten a self-petitioner beta user's own drafting rules
 * (User.draftingRules) — the applicant-owned equivalent of
 * loadAttorneyGuidance, used when the beta user is drafting their own case
 * (see lib/auth.ts canDraftCase).
 */
export async function loadApplicantGuidance(opts: {
  userId: string;
  isPetition: boolean;
  sectionId?: string;
}): Promise<string> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: opts.userId },
      select: { draftingRules: true },
    });
    if (!user?.draftingRules) return "";
    return flattenDraftingRules(user.draftingRules as DraftingRules, opts);
  } catch {
    return "";
  }
}

/**
 * Single entry point every drafting route should call: resolves to the beta
 * applicant's own rules when they're drafting their own case, otherwise the
 * assigned attorney's FirmProfile rules — same call shape either way, so
 * routes don't need their own session.role branch.
 */
export async function resolveDraftingGuidance(
  session: { role: string; userId: string },
  c: { attorneyId?: string | null },
  opts: { isPetition: boolean; sectionId?: string }
): Promise<string> {
  if (session.role === "applicant") {
    return loadApplicantGuidance({ userId: session.userId, ...opts });
  }
  return loadAttorneyGuidance({ attorneyId: c.attorneyId ?? session.userId, ...opts });
}
