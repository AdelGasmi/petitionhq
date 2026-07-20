import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/leads/[id]/beta-reverse — undo a self-petitioner beta invite
 * and put the lead back into the leads pool. The inverse of beta-convert.
 *
 * Body: { force?: boolean }
 *
 * A clean reversal (default) only runs when the invited person never started
 * working — no password set, no beta agreement accepted, no drafts/letters/
 * documents/messages on their case. It tears down the throwaway beta account +
 * case so the email is free again and the lead is cleanly re-invitable.
 *
 * If they HAVE started working, we refuse (409) unless force=true: their work
 * would be destroyed, and "Deactivate beta" (which keeps the account + case) is
 * the right tool for simply ending an active trial. force wipes regardless.
 *
 * The lead is reset to a poolable state (unclaimed, no case, betaInvitedAt
 * cleared, status "new"). applicantStatus is left untouched, so a lead returns
 * with the same matching-consent it had before — a consented lead goes back to
 * the match queue, a non-consented one back to the general pool.
 */
async function _POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSession();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  // Small body; tolerate an empty one (no Content-Length / not-JSON → force:false).
  let force = false;
  try {
    const body = (await req.json()) as { force?: boolean };
    force = body?.force === true;
  } catch {
    /* no/blank body — default force:false */
  }

  const lead = await prisma.lead.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, caseId: true, betaInvitedAt: true },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (!lead.betaInvitedAt) {
    return NextResponse.json({ error: "This lead was not invited to the beta — nothing to reverse." }, { status: 400 });
  }

  const poolReset = {
    claimedByUserId: null,
    claimedAt: null,
    caseId: null,
    betaInvitedAt: null,
    status: "new",
    dossierStatus: "idle",
  } as const;

  // Invited but never converted (e.g. an earlier conversion rolled back): there
  // is no account/case to tear down — just release the lock back to the pool.
  if (!lead.caseId) {
    await prisma.lead.update({ where: { id: lead.id }, data: poolReset });
    logActivity({ actor: admin, action: "lead.beta_reversed", detail: `${lead.name ?? lead.email} (${lead.email}) — lock cleared, no case` });
    return NextResponse.json({ ok: true, tornDown: false });
  }

  const caseRow = await prisma.case.findUnique({
    where: { id: lead.caseId },
    select: { id: true, ownerId: true },
  });
  const ownerId = caseRow?.ownerId ?? null;

  // Has the invited person actually engaged? If so, a wipe destroys real work.
  const owner = ownerId
    ? await prisma.user.findUnique({ where: { id: ownerId }, select: { passwordHash: true, betaAgreementAcceptedAt: true } })
    : null;
  const [letterCount, docCount, messageCount, draftCount] = caseRow
    ? await Promise.all([
        prisma.letter.count({ where: { caseId: caseRow.id } }),
        prisma.document.count({ where: { caseId: caseRow.id, status: { in: ["uploaded", "validated"] } } }),
        prisma.message.count({ where: { caseId: caseRow.id } }),
        prisma.draftUsage.count({ where: { caseId: caseRow.id } }),
      ])
    : [0, 0, 0, 0];
  const hasWork =
    Boolean(owner?.passwordHash) ||
    owner?.betaAgreementAcceptedAt != null ||
    letterCount > 0 ||
    docCount > 0 ||
    messageCount > 0 ||
    draftCount > 0;

  if (hasWork && !force) {
    return NextResponse.json(
      {
        error:
          "This beta user has already started working (activated their account, accepted the agreement, or has drafts). " +
          "Reversing would delete their work. Use “Deactivate beta” to end the trial while keeping their account and case, " +
          "or confirm a force-reverse to wipe everything and return the lead to the pool.",
        needsForce: true,
      },
      { status: 409 },
    );
  }

  // Teardown order mirrors tests/integration/helpers.ts:cleanupTestData — delete
  // every child that references the case (ActivityLog.caseId and DraftUsage/
  // RefundRequest have no cascade), then the case, then the throwaway user, then
  // release the lead. One transaction so a partial failure rolls back entirely.
  const cid = caseRow!.id;
  await prisma.$transaction([
    prisma.activityLog.deleteMany({ where: { caseId: cid } }),
    prisma.letterVersion.deleteMany({ where: { letter: { caseId: cid } } }),
    prisma.letterComment.deleteMany({ where: { letter: { caseId: cid } } }),
    prisma.letter.deleteMany({ where: { caseId: cid } }),
    prisma.document.deleteMany({ where: { caseId: cid } }),
    prisma.sectionComment.deleteMany({ where: { caseId: cid } }),
    prisma.message.deleteMany({ where: { caseId: cid } }),
    prisma.caseNote.deleteMany({ where: { caseId: cid } }),
    prisma.draftUsage.deleteMany({ where: { caseId: cid } }),
    prisma.refundRequest.deleteMany({ where: { caseId: cid } }),
    prisma.case.delete({ where: { id: cid } }),
    ...(ownerId
      ? [
          prisma.token.deleteMany({ where: { subjectId: ownerId } }),
          prisma.user.delete({ where: { id: ownerId } }),
        ]
      : []),
    prisma.lead.update({ where: { id: lead.id }, data: poolReset }),
  ]);

  logActivity({
    actor: admin,
    action: "lead.beta_reversed",
    detail: `${lead.name ?? lead.email} (${lead.email})${force && hasWork ? " — force-wiped active beta" : ""}`,
  });

  return NextResponse.json({ ok: true, tornDown: true });
}

export const POST = withRoute(_POST);
