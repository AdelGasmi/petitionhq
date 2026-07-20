import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNurtureEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

// Schedule: day 1 (immediate after capture), day 7, day 30
const STEPS: { step: 1 | 2 | 3; minAgeDays: number }[] = [
  { step: 1, minAgeDays: 1 },
  { step: 2, minAgeDays: 7 },
  { step: 3, minAgeDays: 30 },
];

/**
 * POST /api/cron/nurture
 * Runs daily. Finds Tier 3 leads eligible for the next nurture email
 * and sends it. Skips leads that have already converted or opted in.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let sent = 0;
  let skipped = 0;

  for (const { step, minAgeDays } of STEPS) {
    const cutoff = new Date(now.getTime() - minAgeDays * 24 * 60 * 60 * 1000);

    // Find leads that:
    // - Are tier3
    // - Haven't converted (no caseId)
    // - Haven't been claimed by an attorney
    // - Are at the previous nurture step (step - 1)
    // - Were captured before the cutoff date
    const leads = await prisma.lead.findMany({
      where: {
        tier: "tier3",
        nurtureStep: step - 1,
        caseId: null,
        applicantStatus: "unclaimed",
        capturedAt: { lte: cutoff },
      },
      select: {
        id: true,
        email: true,
        name: true,
        score: true,
        formData: true,
      },
      take: 50, // batch limit per step per run
    });

    for (const lead of leads) {
      const fd = lead.formData as Record<string, string> | null;
      const field = fd?.field ?? null;

      try {
        await sendNurtureEmail(step, {
          to: lead.email,
          name: lead.name,
          score: lead.score,
          field,
          leadId: lead.id,
        });

        await prisma.lead.update({
          where: { id: lead.id },
          data: { nurtureStep: step, lastNurtureAt: now },
        });

        sent++;
      } catch {
        skipped++;
      }
    }
  }

  return NextResponse.json({ ok: true, sent, skipped });
}
