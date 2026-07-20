import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, addMessage, markMessagesRead } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

function canAccess(
  c: Awaited<ReturnType<typeof readCase>>,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
  if (!c) return false;
  return canAccessCase(session, c);
}

async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccess(c, session))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await markMessagesRead(id, session.userId);
  return NextResponse.json(c.messages ?? []);
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

  // Must have an attorney linked to message
  if (!c.attorneyId && !c.ownerId)
    return NextResponse.json({ error: "No participants to message." }, { status: 400 });

  const { text } = await req.json();
  if (!text?.trim())
    return NextResponse.json({ error: "Message text is required." }, { status: 400 });

  const message = await addMessage(id, {
    senderId: session.userId,
    senderName: session.name,
    senderRole: session.role,
    text: text.trim(),
  });

  logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "message.sent" });
  return NextResponse.json(message, { status: 201 });
}

export const GET = withRoute(_GET);
export const POST = withRoute(_POST);
