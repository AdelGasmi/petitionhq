import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, setAttorney, createInvite, patchCase } from "@/lib/db";
import { getSession, canManageCase } from "@/lib/auth";
import { findUserById } from "@/lib/users";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

function canManage(
  c: Awaited<ReturnType<typeof readCase>>,
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>
) {
  if (!c) return false;
  return canManageCase(session, c);
}

/** Assign a platform attorney by userId */
async function _PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !(await canManage(c, session)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { attorneyId } = await req.json();
  if (!attorneyId) return NextResponse.json({ error: "attorneyId required" }, { status: 400 });

  const attorney = await findUserById(attorneyId);
  if (!attorney || attorney.role !== "attorney")
    return NextResponse.json({ error: "User is not an attorney" }, { status: 400 });

  const updated = await setAttorney(id, attorneyId);
  logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "case.attorney_assigned", detail: attorney.name });
  return NextResponse.json(updated);
}

/**
 * Create an email invite link for a case.
 * Attorney-only — admin blocked (invite links grant case access).
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role === "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !(await canManage(c, session)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: "email required" }, { status: 400 });

  const invite = await createInvite(id, email.trim().toLowerCase());
  if (!invite) return NextResponse.json({ error: "Failed" }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return NextResponse.json({
    link: `${baseUrl}/invite/${invite.token}`,
    expiry: invite.expiry,
  });
}

/** Remove attorney from case (attorney or case owner) */
async function _DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !(await canManage(c, session)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await patchCase(id, { attorneyId: null });
  logActivity({ actor: session, caseId: id, caseTitle: c.title, action: "case.attorney_removed" });
  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
export const PUT = withRoute(_PUT);
export const DELETE = withRoute(_DELETE);
