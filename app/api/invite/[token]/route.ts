import { NextRequest, NextResponse } from "next/server";
import { findCaseByInviteToken, setAttorney } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "attorney")
    return NextResponse.json({ error: "Only attorneys can accept invites" }, { status: 403 });

  const { token } = await params;
  const c = await findCaseByInviteToken(token);
  if (!c) return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });

  await setAttorney(c.id, session.userId);
  return NextResponse.json({ ok: true, caseId: c.id });
}
