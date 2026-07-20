import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findUserByEmail, createBetaApplicantUser } from "@/lib/users";
import { getFounderAttorney } from "@/lib/founder-attorney";
import { autoConvertLead } from "@/lib/lead-convert";
import { sendBetaInviteEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/leads/[id]/beta-convert — one-click self-petitioner beta
 * onboarding (petitionhq/beta_onboarding_plan.md Phase 1). Atomically:
 *  1. claims a single-send lock (Lead.betaInvitedAt) — the guarantee below
 *  2. creates the applicant user with selfPetitionerBeta=true
 *  3. claims the lead as the founder attorney account (concierge lane)
 *  4. reuses autoConvertLead() for case creation + formData prefill (its
 *     default intake-invite email is skipped — see skipIntakeEmail doc)
 *  5. sends the beta invite email (account/password setup) — the only email
 *     a beta user gets on conversion
 *
 * ── Exactly-one-email guarantee ──────────────────────────────────────────
 * A lead can NEVER receive two invite emails. Three independent layers:
 *  (a) friendly pre-checks below return 409 if already invited/claimed/converted;
 *  (b) an atomic compare-and-set on Lead.betaInvitedAt (updateMany where null)
 *      that exactly one concurrent caller can win — the race-proof backstop;
 *  (c) the send is the last step and the lock is never reset once a send has
 *      been attempted, biasing to at-most-once (a rare SMTP failure surfaces a
 *      warning for a deliberate manual resend, never an automatic re-send).
 * Pre-send DB failures release the lock so the lead stays cleanly re-invitable.
 *
 * ── No "an attorney accepted your case" email ────────────────────────────
 * The only email sent is sendBetaInviteEmail ("free beta of our document-
 * preparation software … not a law firm … not legal advice"). autoConvertLead
 * runs with skipIntakeEmail:true (suppresses the "[attorney] has started
 * preparing your petition" email); claiming the lead is a raw update, so the
 * marketplace sendLeadClaimed email cannot fire.
 *
 * Consent (applicantStatus === "approved") is intentionally NOT required: the
 * beta invites applicants to self-serve document software — not attorney
 * matching — so leads who never asked to be matched are eligible. The beta
 * agreement accepted at first login is the consent that governs this path.
 */
async function _POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSession();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, claimedByUserId: true, caseId: true, betaInvitedAt: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

  // Friendly pre-checks (fast, clear errors). The atomic claim below is the
  // real race-proof guard; these just avoid needless work and give better UX.
  if (lead.betaInvitedAt) {
    return NextResponse.json({ error: "This lead has already been invited to the beta." }, { status: 409 });
  }
  if (lead.claimedByUserId || lead.caseId) {
    return NextResponse.json({ error: "Lead is already claimed or converted." }, { status: 409 });
  }

  const existingUser = await findUserByEmail(lead.email);
  if (existingUser) {
    return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });
  }

  const founder = await getFounderAttorney();
  if (!founder) {
    return NextResponse.json({ error: "Founder attorney account not configured." }, { status: 500 });
  }

  // (b) The one-email lock: exactly one concurrent caller flips null → now.
  const claimed = await prisma.lead.updateMany({
    where: { id: lead.id, betaInvitedAt: null },
    data: { betaInvitedAt: new Date() },
  });
  if (claimed.count !== 1) {
    return NextResponse.json({ error: "This lead has already been invited to the beta." }, { status: 409 });
  }

  const name = lead.name?.trim() || lead.email.split("@")[0];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

  let createdUserId: string | null = null;
  let convertedCaseId: string | null = null;
  let emailSendStarted = false;
  try {
    const { user, plaintext } = await createBetaApplicantUser({ email: lead.email, name, createdById: admin.userId });
    createdUserId = user.id;

    await prisma.lead.update({
      where: { id: lead.id },
      data: { claimedByUserId: founder.id, claimedAt: new Date() },
    });

    const converted = await autoConvertLead(lead.id, { skipIntakeEmail: true });
    if (!converted) throw new Error("Lead conversion failed unexpectedly.");
    convertedCaseId = converted.caseId;

    const inviteUrl = `${baseUrl}/invite/user/${plaintext}`;

    // (c) Past this point the lock is permanent — a send has been attempted.
    emailSendStarted = true;
    await sendBetaInviteEmail({ to: lead.email, name, inviteUrl, actor: admin });

    logActivity({
      actor: admin,
      caseId: convertedCaseId,
      action: "lead.beta_converted",
      detail: `${name} (${lead.email}) — self-petitioner beta`,
    });

    return NextResponse.json({ ok: true, userId: user.id, caseId: convertedCaseId }, { status: 201 });
  } catch (e) {
    if (emailSendStarted) {
      // Send phase failed. The account exists and the lock stays set so this
      // lead is never auto-re-invited (at-most-once). sendBetaInviteEmail has
      // already written an EmailLog "failed" row. Recovery = a deliberate
      // manual resend, surfaced to the admin here.
      return NextResponse.json(
        {
          ok: false,
          userId: createdUserId,
          caseId: convertedCaseId,
          warning:
            "Account created, but the invite email failed to send. To avoid a duplicate this lead will NOT be re-invited automatically — trigger a manual resend if needed.",
        },
        { status: 200 },
      );
    }
    // DB phase failed before any email: release the lock and drop the half-
    // created account so the admin can retry cleanly. Nothing was delivered.
    await prisma.lead
      .update({ where: { id: lead.id }, data: { betaInvitedAt: null, claimedByUserId: null, claimedAt: null } })
      .catch(() => {});
    if (createdUserId) await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    throw e;
  }
}

export const POST = withRoute(_POST);
