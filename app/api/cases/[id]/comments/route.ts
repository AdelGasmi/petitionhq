import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, addSectionComment } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";

export const dynamic = "force-dynamic";

function canAccess(
  c: Awaited<ReturnType<typeof readCase>>,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
  if (!c) return false;
  return canAccessCase(session, c);
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { sectionId, text } = await req.json();
  if (!sectionId || !text?.trim())
    return NextResponse.json({ error: "sectionId and text required" }, { status: 400 });

  const comment = await addSectionComment(id, {
    sectionId,
    authorId: session.userId,
    authorName: session.name,
    authorRole: session.role,
    text: text.trim(),
  });

  return NextResponse.json(comment, { status: 201 });
}

export const POST = withRoute(_POST);
