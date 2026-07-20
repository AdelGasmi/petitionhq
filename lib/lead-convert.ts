import { prisma } from "@/lib/prisma";
import { createIntakeToken } from "@/lib/db";
import { sendIntakeInviteEmail } from "@/lib/email";
import { findUserByEmail } from "@/lib/users";
import { encryptPiiFields } from "./pii-crypto";
import logger from "./logger";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://petitionhq.us";

function buildPrefillFromCheckAnswers(checkAnswers: Record<string, unknown>) {
  const pubOption = String(checkAnswers.publications ?? "");
  const citOption = String(checkAnswers.citations ?? "");
  const field = String(checkAnswers.field ?? "");

  const pubCount =
    pubOption.includes("None") ? 0
    : pubOption.includes("1–3") ? 2
    : pubOption.includes("4–10") ? 7
    : pubOption.includes("11–25") ? 18
    : pubOption.includes("More than 25") ? 30
    : null;

  const citCount =
    citOption.includes("None") ? 0
    : citOption.includes("1–50") ? 25
    : citOption.includes("51–200") ? 125
    : citOption.includes("201–500") ? 350
    : citOption.includes("More than 500") ? 600
    : null;

  return {
    qualifications: {
      endeavorField: field,
      ...(pubCount !== null
        ? {
            publications: Array.from({ length: Math.min(pubCount, 3) }, (_, i) => ({
              title: `Publication ${i + 1}`,
              venue: "",
              year: null,
              citations: citCount !== null ? Math.round(citCount / Math.max(pubCount, 1)) : null,
            })),
          }
        : {}),
      highestDegree: (() => {
        const d = String(checkAnswers.degree ?? "");
        if (d.includes("PhD")) return "phd";
        if (d.includes("Master")) return "masters";
        if (d.includes("MD") || d.includes("JD")) return "professional";
        if (d.includes("Bachelor")) return "bachelors";
        return "";
      })(),
    },
    endeavor: {
      endeavorField: field,
    },
  };
}

/**
 * Auto-convert a claimed+approved lead into a case and send the intake email.
 * Idempotent — if the lead already has a caseId, just re-issues an intake token.
 * Returns null if the lead has no claiming attorney (not yet claimable).
 *
 * This is the lead-marketplace path — creates case with prefilled formData from
 * check answers, auto-creates an applicant User (or finds existing), and sets
 * ownerId so the applicant has full portal access (TD-1, TD-2).
 * The admin/onboarding path uses createCase() in lib/db.ts instead.
 *
 * skipIntakeEmail: the self-petitioner beta conversion (beta-convert route)
 * reuses this function for its case-creation logic, but the intake email
 * ("[attorney] has started preparing your petition...") is both redundant
 * (beta users get full logged-in case access, not a magic link) and
 * misleading (no real attorney is working the case) — so it opts out here.
 */
export async function autoConvertLead(
  leadId: string,
  opts?: { skipIntakeEmail?: boolean }
): Promise<{ caseId: string; intakeToken: string | null } | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { claimedBy: true },
  });

  // Guard: no attorney has claimed this lead yet — nothing to create
  if (!lead || !lead.claimedByUserId || !lead.claimedBy) return null;

  let caseId = lead.caseId;

  if (!caseId) {
    const checkAnswers = (lead.formData ?? {}) as Record<string, unknown>;
    const prefill = buildPrefillFromCheckAnswers(checkAnswers);
    const field = String(checkAnswers.field ?? "your field");

    const nameParts = (lead.name ?? "").trim().split(/\s+/);
    const seedPetitionerInfo: Record<string, string> = { email: lead.email };
    if (nameParts.length >= 2) {
      seedPetitionerInfo.givenName = nameParts[0];
      seedPetitionerInfo.familyName = nameParts.slice(1).join(" ");
    } else if (nameParts.length === 1 && nameParts[0]) {
      seedPetitionerInfo.givenName = nameParts[0];
    }

    // Create or find applicant User so they get full portal access
    const existingUser = await findUserByEmail(lead.email);
    let applicantUserId: string;

    if (existingUser) {
      applicantUserId = existingUser.id;
    } else {
      // Create the applicant User stub so the case has a real owner. We don't
      // send a "set up your account" email here — the intake-invite below is
      // the single source of action. They can set up an account later if they
      // want persistent login; the magic-link intake works without one.
      const applicantName = lead.name?.trim() || lead.email.split("@")[0];
      const newUser = await prisma.user.create({
        data: {
          email: lead.email.toLowerCase(),
          name: applicantName,
          role: "applicant",
          passwordHash: "",
          verified: true,
        },
      });
      applicantUserId = newUser.id;
    }

    const newCase = await prisma.case.create({
      data: {
        formId: "i140-niw",
        title: `EB-2 NIW — ${field}`,
        formData: encryptPiiFields({ ...prefill, petitionerInfo: seedPetitionerInfo }) as object,
        ownerId:    applicantUserId,
        attorneyId: lead.claimedByUserId,
      },
    });

    caseId = newCase.id;

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        caseId,
        dossierStatus: "pending",
        status: "contacted",
      },
    });
  }

  if (opts?.skipIntakeEmail) {
    return { caseId, intakeToken: null };
  }

  // Single applicant-facing email on conversion: an intake link. No account
  // required — they fill in their case directly. Avoids the duplicate of also
  // sending a "set up your account" welcome that competes for attention.
  const { token: intakeToken } = await createIntakeToken(caseId, lead.email);
  const intakeUrl = `${BASE_URL}/intake/${intakeToken}`;

  sendIntakeInviteEmail({
    to: lead.email,
    intakeUrl,
    caseTitle: `EB-2 NIW`,
    attorneyName: lead.claimedBy.name,
    caseId,
  }).catch((e) => logger.error("[auto-intake-email] failed:", e));

  return { caseId, intakeToken };
}
