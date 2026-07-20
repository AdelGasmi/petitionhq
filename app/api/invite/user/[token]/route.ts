import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { findUserByInviteToken, acceptUserInvite } from "@/lib/users";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await findUserByInviteToken(token);
  if (!user) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });

  return NextResponse.json({ name: user.name, email: user.email, role: user.role });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const user = await findUserByInviteToken(token);
  if (!user) return NextResponse.json({ error: "Invalid or expired invite link." }, { status: 404 });

  const { password } = await req.json();
  if (!password || password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  await acceptUserInvite(user.id, passwordHash, token);

  const sessionToken = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sv: user.sessionVersion,
  });

  const jar = await cookies();
  jar.set(sessionCookieOptions(sessionToken));

  return NextResponse.json({ ok: true, role: user.role });
}
