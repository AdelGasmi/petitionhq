import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, resolveSectionComment, deleteSectionComment } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canAccess(
  c: Awaited<ReturnType<typeof readCase>>,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
  if (!c) return false;
  return canAccessCase(session, c);
}

/** Mark a comment resolved */
async function _PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await resolveSectionComment(id, commentId);
  return NextResponse.json({ ok: true });
}

/** Delete a comment (author or attorney only) */
async function _DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, commentId } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const comment = (c.sectionComments ?? []).find((sc) => sc.id === commentId);
  if (comment && comment.authorId !== session.userId && session.role !== "attorney" && session.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await deleteSectionComment(id, commentId);
  return NextResponse.json({ ok: true });
}

export const PATCH = withRoute(_PATCH);
export const DELETE = withRoute(_DELETE);
