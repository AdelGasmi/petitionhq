import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createInvitedUser, findUserByEmail } from "@/lib/users";
import { sendUserInviteEmail } from "@/lib/email";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { email, name, role } = await req.json();
  if (!email || !name) return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  if (role && role !== "attorney" && role !== "applicant" && role !== "admin")
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const existing = await findUserByEmail(email);
  if (existing) return NextResponse.json({ error: "A user with that email already exists." }, { status: 409 });

  const { user, plaintext } = await createInvitedUser({
    email,
    name,
    role: role ?? "attorney",
    createdById: admin.userId,
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/user/${plaintext}`;

  await sendUserInviteEmail({
    to: email,
    name,
    inviteUrl,
    invitedBy: admin.name,
    actor: admin,
  });

  logActivity({ actor: admin, action: "user.created", detail: `${name} (${role ?? "attorney"}) — invite sent` });

  return NextResponse.json({ ok: true, userId: user.id }, { status: 201 });
}
