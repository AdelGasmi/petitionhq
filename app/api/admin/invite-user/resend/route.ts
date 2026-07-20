import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { findPublicUserById, reissueUserInvite } from "@/lib/users";
import { sendUserInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required." }, { status: 400 });

  const user = await findPublicUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (!user.pendingInvite) return NextResponse.json({ error: "This account is already active." }, { status: 409 });

  const plaintext = await reissueUserInvite(userId, admin.userId);

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/invite/user/${plaintext}`;

  await sendUserInviteEmail({
    to: user.email,
    name: user.name,
    inviteUrl,
    invitedBy: admin.name,
    actor: admin,
  });

  return NextResponse.json({ ok: true });
}
