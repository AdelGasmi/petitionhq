import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendRecommenderNudgeEmail } from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * POST /api/cron/remind-recommenders
 *
 * Runs daily. Finds letters with active review tokens where the recommender
 * hasn't submitted after 5+ days, and sends a nudge email.
 *
 * Nudge schedule:
 *   - 1st nudge: 5 days after invite sent
 *   - 2nd nudge: 10 days after invite sent
 *   - No further nudges (token expires at 14 days anyway)
 *
 * Uses EmailLog with kind "review-nudge" to avoid duplicate sends.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
  const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  // Find active letter_review tokens created >5 days ago (recommender hasn't responded)
  const pendingTokens = await prisma.token.findMany({
    where: {
      kind: "letter_review",
      subjectType: "letter",
      consumedAt: null,
      expiresAt: { gt: now }, // still valid
      createdAt: { lt: fiveDaysAgo }, // sent >5 days ago
    },
    select: {
      id: true,
      subjectId: true, // letterId
      createdAt: true,
    },
  });

  if (pendingTokens.length === 0) {
    return NextResponse.json({ ok: true, nudged: 0, skipped: 0 });
  }

  // Load the letters + case info for these tokens
  const letterIds = pendingTokens.map((t) => t.subjectId);
  const letters = await prisma.letter.findMany({
    where: {
      id: { in: letterIds },
      reviewerSubmitted: null, // definitely not submitted
    },
    include: {
      case: { select: { id: true, title: true, formData: true } },
    },
  });

  const letterMap = new Map(letters.map((l) => [l.id, l]));

  // Check which letters already received a nudge recently
  // (avoid double-nudging on the same day or sending 3rd nudge)
  const existingNudges = await prisma.emailLog.findMany({
    where: {
      kind: "review-nudge",
      caseId: { in: letters.map((l) => l.caseId) },
    },
    select: { caseId: true, to: true, createdAt: true },
  });

  // Build a map: letterId → nudge count
  const nudgeCountMap = new Map<string, number>();
  for (const letter of letters) {
    const rec = letter.recommender as Record<string, unknown>;
    const email = String(rec.email ?? "");
    const count = existingNudges.filter(
      (n) => n.caseId === letter.caseId && n.to === email
    ).length;
    nudgeCountMap.set(letter.id, count);
  }

  let nudged = 0;
  let skipped = 0;

  for (const token of pendingTokens) {
    const letter = letterMap.get(token.subjectId);
    if (!letter) { skipped++; continue; }

    const rec = letter.recommender as Record<string, unknown>;
    const email = String(rec.email ?? "");
    const name = String(rec.name ?? "Recommender");

    if (!email.includes("@")) { skipped++; continue; }

    const nudgeCount = nudgeCountMap.get(letter.id) ?? 0;

    // Nudge schedule: nudge 1 at 5 days, nudge 2 at 10 days, then stop
    if (nudgeCount >= 2) { skipped++; continue; }
    if (nudgeCount === 1 && token.createdAt > tenDaysAgo) { skipped++; continue; }

    const fd = letter.case.formData as Record<string, unknown>;
    const pi = (fd["petitioner-info"] ?? fd["petitionerInfo"] ?? {}) as Record<string, unknown>;
    const applicantName = String(pi.fullName ?? pi.givenName ?? "the applicant");
    const daysWaiting = Math.floor((now.getTime() - token.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    try {
      await sendRecommenderNudgeEmail({
        to: email,
        recommenderName: name,
        applicantName,
        daysWaiting,
        isSecondNudge: nudgeCount === 1,
        caseId: letter.caseId,
        caseTitle: letter.case.title,
      });
      nudged++;
      logger.log(`[cron/remind-recommenders] nudged ${email} for letter ${letter.id} (${daysWaiting}d, nudge #${nudgeCount + 1})`);
    } catch (e) {
      skipped++;
      logger.error(`[cron/remind-recommenders] failed to nudge ${email}:`, e);
    }
  }

  return NextResponse.json({ ok: true, nudged, skipped, checked: pendingTokens.length });
}
