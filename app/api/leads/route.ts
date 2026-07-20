import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leadsCsvFilename } from "@/lib/fileNames";
import { sendLeadAdminAlert, sendLeadConfirmation } from "@/lib/email";
import { tierFor, canonicalToLegacyTier, clampScoreToEvidence } from "@/lib/scoring";
import { trackFunnel } from "@/lib/funnel";
import { quickPing } from "@/lib/verification/orchestrator";
import { nextMaturity } from "@/lib/leadMaturity";
import type { LeadMaturity } from "@/lib/leadMaturity";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

function classifyTier(score: number | undefined): string {
  if (!score) return "tier3";
  return canonicalToLegacyTier(tierFor(score));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await (await import("@/lib/body-limit")).parseJsonBody(req, 32_768)) as {
      email: string;
      firstName?: string;
      lastName?: string;
      name?: string;
      tier?: string;
      score?: number;
      formData?: Record<string, unknown>;
      summary?: string;
      dimensions?: { label: string; score: number; notes?: string }[];
      gapNarrative?: { strengths?: string; blockers?: string; legalLeverage?: string };
      source?: string;
      refCode?: string;
      turnstileToken?: string;
    };

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const { verifyTurnstile } = await import("@/lib/turnstile");
    if (!(await verifyTurnstile(body.turnstileToken, ip))) {
      return NextResponse.json({ error: "CAPTCHA verification failed." }, { status: 403 });
    }

    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email required" }, { status: 400 });
    }

    // Both first and last name are required — the orchestrator matches on full
    // name against public research records, and separate parts let us construct
    // the combination without guessing. Enforce both server-side; client also
    // validates. Legacy `name` field accepted as a combined fallback.
    const firstName = body.firstName?.trim() ?? "";
    const lastName = body.lastName?.trim() ?? "";
    if (body.firstName !== undefined || body.lastName !== undefined) {
      if (!firstName) {
        return NextResponse.json({ error: "Please enter your first name." }, { status: 400 });
      }
      if (!lastName) {
        return NextResponse.json({ error: "Please enter your last name." }, { status: 400 });
      }
    } else if (!body.name?.trim() || body.name.trim().length < 2) {
      return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
    }
    const name = firstName && lastName ? `${firstName} ${lastName}` : (body.name?.trim() ?? "");

    // Clamp the client-supplied score to what the self-reported evidence
    // actually supports BEFORE it is persisted. Lead.score is the single source
    // of truth every downstream surface reads (dossier, brief, cron, admin), so
    // the ceiling is enforced here at the write boundary — never trusted from
    // the client. See lib/scoring.ts → clampScoreToEvidence / evidenceCeiling.
    const clampedScore = clampScoreToEvidence(body.score, body.formData) ?? undefined;
    const tier = classifyTier(clampedScore);
    const emailKey = body.email.trim().toLowerCase();
    const field = (body.formData?.field as string) ?? undefined;

    const existing = await prisma.lead.findUnique({
      where: { email: emailKey },
      select: { id: true, name: true, resultToken: true },
    });
    if (existing) {
      return NextResponse.json({
        ok: true,
        leadId: existing.id,
        existing: true,
        existingName: existing.name,
        resultToken: existing.resultToken,
      });
    }

    const resultToken = randomBytes(24).toString("hex");

    const newMaturity = nextMaturity("M0" as LeadMaturity, "light_wizard_complete");

    // Merge firstName/lastName into formData so the verification orchestrator
    // can construct the full name without relying solely on lead.name fallback.
    const enrichedFormData = {
      ...(body.formData ?? {}),
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    };

    const lead = await prisma.lead.create({
      data: {
        email: emailKey,
        resultToken,
        name: name || null,
        tier,
        score: clampedScore ?? null,
        formData: enrichedFormData as object,
        source: body.source ?? "check",
        refCode: body.refCode ?? null,
        status: "new",
        ...(newMaturity ? { maturity: newMaturity } : {}),
      },
    });

    trackFunnel({ event: "lead.email_submitted", leadId: lead.id, props: { tier, score: clampedScore } });

    // Fire-and-forget verification quickPing (OpenAlex + ROR, 4s timeout)
    // Stores preliminary result in Lead.verifiedClaims.preliminary
    const pingTimeout = new Promise<void>((resolve) => setTimeout(resolve, 4_000));
    Promise.race([
      quickPing(lead.id).then((ping) => {
        trackFunnel({
          event: "verification.preliminary_completed",
          leadId: lead.id,
          props: { found: ping.found, matchConfidence: ping.matchConfidence },
        });
      }),
      pingTimeout,
    ]).catch((e) => logger.error("[quick-ping] failed:", e));

    sendLeadAdminAlert({
      leadId: lead.id,
      email: emailKey,
      name: name || undefined,
      score: clampedScore,
      tier,
      field,
    }).catch((e) => logger.error("[lead-admin-alert] failed:", e));

    // The /api/leads gate is structurally always the 5-question PRELIMINARY pass
    // (onEmailComplete posts light answers only). Flag it so the email is framed
    // as provisional — the authoritative "complete" email is sent from the
    // deep-intake reassess, carrying the same dimensions the result page shows.
    sendLeadConfirmation({
      to: emailKey,
      name: name || undefined,
      tier,
      resultToken,
      summary: body.summary,
      dimensions: body.dimensions,
      gapNarrative: body.gapNarrative,
      isPreliminary: true,
    }).catch((e) => logger.error("[lead-confirmation] failed:", e));

    return NextResponse.json({ ok: true, leadId: lead.id, resultToken });
  } catch (err) {
    logger.error("[lead-capture] DB error:", err);
    return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tier = searchParams.get("tier");
  const status = searchParams.get("status");
  const format = searchParams.get("format");

  const leads = await prisma.lead.findMany({
    where: {
      ...(tier ? { tier } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { capturedAt: "desc" },
    take: 500,
  });

  if (format === "csv") {
    // PII stripped from admin export — no email/name columns
    const rows = [
      ["id", "tier", "score", "status", "refCode", "source", "capturedAt"].join(","),
      ...leads.map((l) =>
        [
          l.id,
          l.tier ?? "",
          l.score ?? "",
          l.status,
          l.refCode ?? "",
          l.source,
          l.capturedAt.toISOString(),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${leadsCsvFilename()}"`,
      },
    });
  }

  return NextResponse.json({ leads });
}
