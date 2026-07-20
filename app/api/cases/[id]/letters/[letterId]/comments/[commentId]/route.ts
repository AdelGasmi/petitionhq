import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, resolveLetterComment, deleteLetterComment } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canAccess(
  c: Awaited<ReturnType<typeof readCase>>,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
  if (!c) return false;
  if (session.role === "attorney") return true;
  return c.ownerId === session.userId;
}

async function _PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "applicant") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, letterId, commentId } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await resolveLetterComment(id, letterId, commentId);
  return NextResponse.json({ ok: true });
}

async function _DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "applicant") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, letterId, commentId } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = (c.letters[letterId]?.comments ?? []).find((lc) => lc.id === commentId);
  if (comment && comment.authorId !== session.userId && session.role !== "attorney")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteLetterComment(id, letterId, commentId);
  return NextResponse.json({ ok: true });
}

export const PATCH = withRoute(_PATCH);
export const DELETE = withRoute(_DELETE);
