import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import bcrypt from "bcryptjs";
import { createUser, countUsers } from "@/lib/users";
import { signToken, sessionCookieOptions } from "@/lib/auth";

async function _POST(req: NextRequest) {
  // Only works when no users exist
  const count = await countUsers();
  if (count > 0) {
    return NextResponse.json(
      { error: "Setup already complete. Log in instead." },
      { status: 403 }
    );
  }

  const { email, password, name } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await createUser({ email, passwordHash, name, role: "attorney" });

  const token = await signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sv: user.sessionVersion,
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieOptions(token));
  return res;
}

export const POST = withRoute(_POST);
