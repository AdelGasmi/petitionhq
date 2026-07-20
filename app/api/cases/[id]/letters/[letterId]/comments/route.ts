import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, addLetterComment } from "@/lib/db";
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
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "applicant") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { text } = await req.json();
  if (!text?.trim())
    return NextResponse.json({ error: "text required" }, { status: 400 });

  const comment = await addLetterComment(id, letterId, {
    authorId: session.userId,
    authorName: session.name,
    authorRole: session.role,
    text: text.trim(),
  });

  return NextResponse.json(comment, { status: 201 });
}

export const POST = withRoute(_POST);
