import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { cookies } from "next/headers";
import { findUserById, consumeVerifyCode } from "@/lib/users";
import { signToken, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function _POST(req: NextRequest) {
  const { userId, code } = await req.json();

  if (!userId || !code) {
    return NextResponse.json({ error: "userId and code are required." }, { status: 400 });
  }

  const result = await consumeVerifyCode(userId, code.trim());

  if (result === "expired") {
    return NextResponse.json(
      { error: "This code has expired. Request a new one." },
      { status: 410 }
    );
  }
  if (result === "wrong") {
    return NextResponse.json({ error: "Incorrect code. Please try again." }, { status: 400 });
  }

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sv: user.sessionVersion,
  });

  const jar = await cookies();
  jar.set(sessionCookieOptions(token));

  return NextResponse.json({ ok: true, role: user.role, needsOnboarding: !user.plan });
}

export const POST = withRoute(_POST);
