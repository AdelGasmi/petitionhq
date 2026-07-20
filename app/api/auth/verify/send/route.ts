import { NextRequest, NextResponse } from "next/server";
import { findUserById, issueVerifyCode } from "@/lib/users";
import { sendVerificationEmail } from "@/lib/email";
import { sendVerificationCall, sendVerificationSms, isTwilioConfigured } from "@/lib/phone";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { userId, channel } = await req.json();

  if (!userId || !channel) {
    return NextResponse.json({ error: "userId and channel are required." }, { status: 400 });
  }

  const user = await findUserById(userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });
  if (user.verified) return NextResponse.json({ error: "Account is already verified." }, { status: 409 });

  const code = await issueVerifyCode(userId);

  const isDev = process.env.NODE_ENV === "development";

  if (channel === "email") {
    if (isDev) {
      logger.log(`[verify/send] dev mode — skipping email, code: ${code}`);
    } else {
      try {
        await sendVerificationEmail({ to: user.email, name: user.name, code });
      } catch (e) {
        logger.error("[verify/send]", e);
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Failed to send verification email." },
          { status: 500 }
        );
      }
    }
  } else if (channel === "call" || channel === "sms") {
    if (!isTwilioConfigured()) {
      return NextResponse.json(
        { error: "Phone verification is not configured on this server." },
        { status: 503 }
      );
    }
    if (!user.phone) {
      return NextResponse.json({ error: "No phone number on file." }, { status: 400 });
    }
    try {
      if (channel === "call") {
        await sendVerificationCall(user.phone, code);
      } else {
        await sendVerificationSms(user.phone, code);
      }
    } catch (e) {
      logger.error("[verify/send]", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Failed to send verification." },
        { status: 500 }
      );
    }
  } else {
    return NextResponse.json({ error: "Invalid channel." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    channel,
    maskedTarget: channel === "email"
      ? maskEmail(user.email)
      : maskPhone(user.phone ?? ""),
    ...(isDev && { _devCode: code }),
  });
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local[0]}***@${domain}`;
}

function maskPhone(phone: string) {
  return phone.replace(/\d(?=\d{4})/g, "*");
}
