import { NextRequest, NextResponse } from "next/server";
import { sendNotificationEmail } from "@/lib/email";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "hello@petitionhq.us";

// Lead-capture form only. Bar credentials are public records that we verify
// manually via the state bar lookup using name+firm — no need to ask for them
// upfront. Matches industry pattern (UpCounsel, Clio Grow, LegalMatch).
const REQUIRED_FIELDS = ["name", "email", "firmName"] as const;

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  for (const field of REQUIRED_FIELDS) {
    if (!body[field]?.trim()) {
      return NextResponse.json({ error: `${field} is required.` }, { status: 400 });
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const text = [
    `New attorney partner application:`,
    ``,
    `Name:            ${body.name}`,
    `Email:           ${body.email}`,
    `Firm:            ${body.firmName}`,
    `NIW experience:  ${body.niwExperience || "—"}`,
    `Phone:           ${body.phone || "—"}`,
    `How heard:       ${body.howHeard || "—"}`,
    ``,
    `Verify bar credentials via state-bar lookup on name+firm before approving.`,
    `Submitted at:    ${new Date().toISOString()}`,
  ].join("\n");

  try {
    await sendNotificationEmail({
      to: ADMIN_EMAIL,
      subject: `[PetitionHQ] Attorney application: ${body.name} — ${body.firmName}`,
      text,
    });
  } catch (err) {
    logger.error("[attorney-apply] Email send failed:", err);
    return NextResponse.json({ error: "Failed to submit application. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
