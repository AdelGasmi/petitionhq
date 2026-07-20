import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Lightweight beacon endpoint for client-side funnel events.
 * No auth required — this serves public pages (/check).
 * Accepts navigator.sendBeacon() payloads (small JSON).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.event !== "string") {
      return NextResponse.json({ error: "bad request" }, { status: 400 });
    }

    // Only allow known client-side event prefixes.
    // "export." = grounding-gate telemetry fired from the authed editor (LetterEditor).
    const ALLOWED_PREFIXES = ["check.", "export."];
    if (!ALLOWED_PREFIXES.some((p) => body.event.startsWith(p))) {
      return NextResponse.json({ error: "unknown event" }, { status: 400 });
    }

    // Cap props size to prevent abuse
    const props = body.props && typeof body.props === "object" ? body.props : undefined;

    await prisma.funnelEvent.create({
      data: {
        event: body.event,
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
        props: props ?? undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    logger.error("[funnel-beacon]", e);
    return NextResponse.json({ ok: true }); // swallow errors — never break the client
  }
}
