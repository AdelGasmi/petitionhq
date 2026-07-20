import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";
import type { DraftingRules } from "@/app/api/attorney-rules/route";

export const dynamic = "force-dynamic";

/**
 * GET/PUT /api/profile/drafting-rules — a self-petitioner beta user's own
 * drafting rules (User.draftingRules), the applicant-owned equivalent of
 * /api/attorney-rules (FirmProfile.draftingRules). Gated to beta-flagged
 * applicants only — a real marketplace applicant has no drafting access to
 * configure rules for.
 */
async function requireBetaApplicant() {
  const session = await getSession();
  if (!session || session.role !== "applicant") return null;
  const user = await findUserById(session.userId);
  if (!user?.selfPetitionerBeta) return null;
  return session;
}

export async function GET() {
  const session = await requireBetaApplicant();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { draftingRules: true },
  });
  const rules = (user?.draftingRules ?? {}) as DraftingRules;
  return NextResponse.json({ rules });
}

export async function PUT(req: NextRequest) {
  const session = await requireBetaApplicant();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { rules: DraftingRules };
  try {
    body = await parseJsonBody(req, 4_096);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { draftingRules: body.rules as object },
  });

  return NextResponse.json({ ok: true });
}
