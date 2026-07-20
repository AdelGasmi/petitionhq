import { NextRequest, NextResponse } from "next/server";
import { requireSession, signToken, sessionCookieOptions } from "@/lib/auth";
import { findUserById, updateUser } from "@/lib/users";
import { prisma } from "@/lib/prisma";
import { setSessionRevocationVersion } from "@/lib/session-revoke";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { currentPassword, newPassword } = await req.json();

  if (!newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  const user = await findUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  // Google-only accounts have no password — allow setting one without current password
  const hasPassword = !!user.passwordHash;
  if (hasPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Current password is required." }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash!);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
    }
  }

  const hash = await bcrypt.hash(newPassword, 12);
  await updateUser(session.userId, { passwordHash: hash });

  // S-13: revoke all existing sessions, re-issue this one with the new version
  const updated = await prisma.user.update({
    where: { id: session.userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true, email: true, role: true, name: true },
  });
  await setSessionRevocationVersion(session.userId, updated.sessionVersion);

  const newToken = await signToken({
    userId: session.userId,
    email: updated.email,
    role: updated.role as "admin" | "attorney" | "applicant",
    name: updated.name,
    sv: updated.sessionVersion,
  });
  const jar = await cookies();
  jar.set(sessionCookieOptions(newToken));

  return NextResponse.json({ ok: true });
}
