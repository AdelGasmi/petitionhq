import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/users/[id]/beta-deactivate — end a user's self-petitioner
 * beta trial. Clears selfPetitionerBeta only: the account, case, and
 * ownership are untouched — they just lose the canDraftCase() self-serve
 * drafting unlock (falls back to whatever the assigned attorney can do).
 * Idempotent kill switch, separate from the harder User.suspended lockout.
 */
async function _POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSession();
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, selfPetitionerBeta: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({ where: { id }, data: { selfPetitionerBeta: false } });

  logActivity({
    actor: admin,
    action: "user.beta_deactivated",
    detail: `${user.name} (${user.email})`,
  });

  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
