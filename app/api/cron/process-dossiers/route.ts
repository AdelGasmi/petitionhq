import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateDossier } from "@/lib/dossierGenerator";
import { renderDossierPdf } from "@/lib/dossierPdf";
import { storagePut } from "@/lib/storage";
import { dossierStorageKey } from "@/lib/fileNames";
import { trackFunnel } from "@/lib/funnel";
import { resolveCandidateScore } from "@/lib/scoring";
import { nextMaturity } from "@/lib/leadMaturity";
import type { LeadMaturity } from "@/lib/leadMaturity";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_SECRET = process.env.CRON_SECRET ?? "";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Reap stale "processing" rows — anything stuck for >10 min was abandoned
  // by a prior timed-out invocation (maxDuration = 300s). Mark them "failed"
  // so the admin can see them and re-queue via the /requeue-dossier action.
  const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
  const reaped = await prisma.lead.updateMany({
    where: { dossierStatus: "processing", updatedAt: { lt: staleThreshold } },
    data: { dossierStatus: "failed" },
  });
  if (reaped.count > 0) {
    logger.warn(`[dossier-cron] Reaped ${reaped.count} stale "processing" lead(s) → "failed"`);
  }

  const pending = await prisma.lead.findMany({
    where: { dossierStatus: "pending", caseId: { not: null } },
    orderBy: { capturedAt: "asc" },
    take: 3,
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  await prisma.lead.updateMany({
    where: { id: { in: pending.map((l) => l.id) } },
    data: { dossierStatus: "processing" },
  });

  const results = await Promise.allSettled(
    pending.map(async (lead) => {
      const vc = lead.verifiedClaims as Record<string, { status: string; source: string; sourceUrl?: string; confidence: number; detail?: string }> | null;
      // Evidence-ceiling guard on the read path: the cached PDF this cron writes
      // must carry an evidence-supported score/tier, even for legacy leads.
      const { score: candidateScore, tier: candidateTier } = resolveCandidateScore(
        lead.score,
        lead.formData as Record<string, unknown> | null,
        lead.tier ?? "tier3",
      );
      const data = await generateDossier(lead.caseId!, candidateTier, candidateScore, lead.id, vc);
      const pdfBuffer = await renderDossierPdf(data, {
        trustScore: lead.trustScore,
        verifiedClaims: vc,
      });

      const storageKey = dossierStorageKey(lead.id, lead.name, candidateTier, lead.capturedAt);
      await storagePut(storageKey, pdfBuffer, "application/pdf");

      const dossierMaturity = nextMaturity(lead.maturity as LeadMaturity, "dossier_complete");

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          dossierStatus: "completed",
          dossierPdfPath: storageKey,
          ...(dossierMaturity ? { maturity: dossierMaturity } : {}),
        },
      });

      trackFunnel({ event: "dossier.generated", leadId: lead.id, props: { tier: candidateTier } });

      return { id: lead.id, status: "completed" as const };
    })
  );

  const summary = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    const error = r.reason instanceof Error ? r.reason.message : String(r.reason);
    logger.error(`[dossier-cron] Failed for lead ${pending[i].id}:`, error);
    prisma.lead.update({ where: { id: pending[i].id }, data: { dossierStatus: "failed" } }).catch(() => {});
    return { id: pending[i].id, status: "failed" as const, error };
  });

  return NextResponse.json({ ok: true, processed: summary.length, results: summary });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? "";
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const count = await prisma.lead.count({ where: { dossierStatus: "pending" } });
  return NextResponse.json({ ok: true, pendingCount: count });
}
