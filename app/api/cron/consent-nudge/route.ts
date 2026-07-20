import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendConsentNudge } from "@/lib/email";
import { trackFunnel } from "@/lib/funnel";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

/**
 * POST /api/cron/consent-nudge
 *
 * MANUAL trigger — deliberately NOT installed by setup-cron.sh. Nudges
 * marketplace-ready (M7) leads that never opted in to attorney matching,
 * linking them to their own results page where the one-click ConsentCard
 * lives. The email promises "we won't ask again", so each lead is nudged
 * at most once, ever (deduped against EmailLog kind=consent-nudge).
 *
 * Query params:
 *   ?dryRun=1     — report who would be nudged, send nothing
 *   ?leadId=<id>  — restrict to a single lead (testing / targeted resend)
 *   ?limit=N      — cap sends per run (default 50, max 100)
 *
 * Usage from the prod host:
 *   curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" \
 *     "http://localhost:3000/api/cron/consent-nudge?dryRun=1"
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const onlyLeadId = url.searchParams.get("leadId");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    100
  );

  const leads = await prisma.lead.findMany({
    where: {
      ...(onlyLeadId ? { id: onlyLeadId } : {}),
      maturity: "M7",
      applicantStatus: "unclaimed",
      caseId: null,
      claimedByUserId: null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      resultToken: true,
      formData: true,
      trustScore: true,
    },
    orderBy: { trustScore: "desc" },
    take: limit,
  });

  let sent = 0;
  let skipped = 0;
  const results: { id: string; status: "sent" | "would-send" | "already-nudged" | "failed" | "skipped" }[] = [];

  for (const lead of leads) {
    if (!lead.email || !lead.resultToken) {
      skipped++;
      results.push({ id: lead.id, status: "skipped" });
      continue;
    }

    const prior = await prisma.emailLog.findFirst({
      where: { to: lead.email, kind: "consent-nudge", status: "sent" },
      select: { id: true },
    });
    if (prior) {
      skipped++;
      results.push({ id: lead.id, status: "already-nudged" });
      continue;
    }

    if (dryRun) {
      results.push({ id: lead.id, status: "would-send" });
      continue;
    }

    const fd = lead.formData as Record<string, string> | null;
    try {
      await sendConsentNudge({
        to: lead.email,
        name: lead.name,
        field: fd?.field ?? null,
        resultToken: lead.resultToken,
      });
      trackFunnel({ event: "lead.consent_nudged", leadId: lead.id });
      sent++;
      results.push({ id: lead.id, status: "sent" });
    } catch (e) {
      logger.error("[consent-nudge] send failed:", lead.id, e);
      results.push({ id: lead.id, status: "failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    eligible: leads.length,
    sent,
    skipped,
    results,
  });
}
