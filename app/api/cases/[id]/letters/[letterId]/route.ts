import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, upsertLetter } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const body = await req.json();
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = c.letters[letterId];
  if (!existing) return NextResponse.json({ error: "letter not found" }, { status: 404 });

  const updated = {
    ...existing,
    ...body,
    recommender: body.recommender ?? existing.recommender,
    updatedAt: new Date().toISOString(),
  };
  await upsertLetter(id, updated);
  return NextResponse.json(updated);
}

async function _DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.letter.delete({ where: { id: letterId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}

export const PATCH = withRoute(_PATCH);
export const DELETE = withRoute(_DELETE);
