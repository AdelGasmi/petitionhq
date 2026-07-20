import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";
const GHOST_DAYS = 14;

/**
 * POST /api/cron/release-ghosted-pilots
 * Daily cron. Finds pilot-claimed leads where the applicant hasn't responded
 * in 14+ days and releases them back to the pool (no Stripe — pilots pay nothing).
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - GHOST_DAYS * 24 * 60 * 60 * 1000);

  const ghostedLeads = await prisma.lead.findMany({
    where: {
      claimedAt: { lt: cutoff, not: null },
      applicantStatus: "pending_approval",
      status: "claimed",
      claimPayment: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      caseId: true,
      claimedByUserId: true,
    },
  });

  let released = 0;
  let skipped = 0;

  for (const lead of ghostedLeads) {
    if (!lead.claimedByUserId) {
      skipped++;
      continue;
    }

    const firm = await prisma.firmProfile.findUnique({
      where: { userId: lead.claimedByUserId },
      select: { networkTier: true },
    });

    if (firm?.networkTier !== "pilot") {
      skipped++;
      continue;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "new",
        claimedByUserId: null,
        claimedAt: null,
        applicantStatus: "unclaimed",
        caseId: null,
      },
    });

    logActivity({
      caseId: lead.caseId ?? undefined,
      action: "lead.pilot_ghost_released",
      detail: `Auto-released pilot claim after ${GHOST_DAYS} days of no response.`,
    });

    const attorney = await prisma.user.findUnique({
      where: { id: lead.claimedByUserId },
      select: { email: true, name: true },
    });

    if (attorney) {
      const { sendNotificationEmail } = await import("@/lib/email");
      sendNotificationEmail({
        to: attorney.email,
        subject: "Lead released — applicant did not respond",
        text: `Hi ${attorney.name ?? "there"},\n\nThe applicant you claimed has not responded within ${GHOST_DAYS} days. The lead has been released back to the pool.\n\nSince this was a pilot-tier claim, no payment was involved.\n\n— petitionhq.us`,
      }).catch(() => {});
    }

    released++;
    logger.log(`[pilot-ghost-release] Released lead ${lead.id}`);
  }

  logger.log(`[pilot-ghost-release] Complete: ${released} released, ${skipped} skipped`);

  return NextResponse.json({
    ok: true,
    processed: ghostedLeads.length,
    released,
    skipped,
  });
}
