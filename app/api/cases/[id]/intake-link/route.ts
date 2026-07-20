import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, createIntakeToken } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { sendIntakeInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

/**
 * Send an intake invitation link to an applicant.
 * Attorney-only — admin blocked (intake links grant write access to case content).
 */
async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "attorney") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.formId !== "i140-niw") return NextResponse.json({ error: "Intake links are only available for NIW cases" }, { status: 400 });

  const { email } = await req.json().catch(() => ({})) as { email?: string };
  if (!email?.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  const { token } = await createIntakeToken(id, email);
  const intakeUrl = `${baseUrl}/intake/${token}`;

  await sendIntakeInviteEmail({
    to: email,
    intakeUrl,
    caseTitle: c.title,
    attorneyName: session.name,
    caseId: id,
    actor: session,
  });

  return NextResponse.json({ ok: true, intakeUrl });
}

export const POST = withRoute(_POST);
