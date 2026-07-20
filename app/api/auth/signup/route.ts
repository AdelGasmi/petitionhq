import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { findUserByEmail, createUser } from "@/lib/users";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";
import { verifyTurnstile } from "@/lib/turnstile";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    let body: { name?: string; email?: string; phone?: string; password?: string; turnstileToken?: string };
    try {
      body = await parseJsonBody(req, 8_192);
    } catch (e) {
      if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (!(await verifyTurnstile(body.turnstileToken, ip))) {
      return NextResponse.json({ error: "CAPTCHA verification failed. Please try again." }, { status: 403 });
    }

    const { name, email, phone, password } = body;

    if (!name?.trim() || !email?.trim() || !password)
      return NextResponse.json({ error: "Name, email, and password are required." }, { status: 400 });

    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const existing = await findUserByEmail(email);
    if (existing)
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await createUser({
      email,
      name: name.trim(),
      role: "applicant",
      passwordHash,
      phone: phone?.trim() || undefined,
      verified: false,
    });

    return NextResponse.json({ userId: user.id }, { status: 201 });
  } catch (e) {
    logger.error("[signup]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sign-up failed. Please try again." },
      { status: 500 }
    );
  }
}
