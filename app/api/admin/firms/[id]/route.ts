import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { setSessionRevocationVersion } from "@/lib/session-revoke";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/firms/[id] — admin actions on a firm.
 *
 * Actions:
 *   { action: "suspend" }      — suspend the firm's attorney account, revoke sessions
 *   { action: "unsuspend" }    — re-enable the firm's attorney account
 *   { action: "set-tier", tier: "pilot"|"standard"|"premium" }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { action?: string; tier?: string };
  try {
    body = await parseJsonBody(req, 2_048);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const firm = await prisma.firmProfile.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, sessionVersion: true } } },
  });

  if (!firm) {
    return NextResponse.json({ error: "Firm not found" }, { status: 404 });
  }

  const { action } = body;

  // ── Suspend ─────────────────────────────────────────────────────────
  if (action === "suspend") {
    const newSv = (firm.user.sessionVersion ?? 1) + 1;
    await prisma.user.update({
      where: { id: firm.userId },
      data: { suspended: true, sessionVersion: newSv },
    });
    // Revoke all active sessions immediately via Redis
    await setSessionRevocationVersion(firm.userId, newSv);

    logActivity({
      actor: session,
      action: "firm.suspended",
      detail: `${firm.firmName ?? firm.id} (attorney: ${firm.user.name})`,
    });

    return NextResponse.json({ ok: true, action: "suspended" });
  }

  // ── Unsuspend ───────────────────────────────────────────────────────
  if (action === "unsuspend") {
    await prisma.user.update({
      where: { id: firm.userId },
      data: { suspended: false },
    });

    logActivity({
      actor: session,
      action: "firm.unsuspended",
      detail: `${firm.firmName ?? firm.id} (attorney: ${firm.user.name})`,
    });

    return NextResponse.json({ ok: true, action: "unsuspended" });
  }

  // ── Set tier ────────────────────────────────────────────────────────
  if (action === "set-tier") {
    const tier = body.tier;
    if (!tier || !["pilot", "standard", "premium"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier. Must be pilot, standard, or premium." }, { status: 400 });
    }

    await prisma.firmProfile.update({
      where: { id },
      data: { networkTier: tier },
    });

    logActivity({
      actor: session,
      action: "firm.tier_changed",
      detail: `${firm.firmName ?? firm.id} → ${tier}`,
    });

    return NextResponse.json({ ok: true, action: "tier_changed", tier });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
