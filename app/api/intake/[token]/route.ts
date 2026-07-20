import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getCaseByIntakeToken, patchFormData } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { isIntakeVerified } from "@/lib/intake-auth";

export const dynamic = "force-dynamic";

// Allowlist of top-level formData keys this token is permitted to write.
const ALLOWED_KEYS = new Set(["qualifications", "endeavor", "petitionerInfo"]);

const UNVERIFIED = NextResponse.json(
  { error: "Email not verified" },
  { status: 403 }
);

async function _GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!(await isIntakeVerified(token))) return UNVERIFIED;
  const c = await getCaseByIntakeToken(token);
  if (!c) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  return NextResponse.json({ caseId: c.id, title: c.title, formData: c.formData });
}

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  if (!(await isIntakeVerified(token))) return UNVERIFIED;
  const c = await getCaseByIntakeToken(token);
  if (!c) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  if (c.filedAt) {
    return NextResponse.json(
      { error: "This case has been filed and can no longer be edited." },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({})) as {
    formData?: Record<string, unknown>;
    completed?: boolean;
  };
  if (!body.formData) return NextResponse.json({ error: "No data" }, { status: 400 });

  // Strictly limit which sections can be written via an intake token
  const safeUpdate: Record<string, unknown> = {};
  for (const key of Object.keys(body.formData)) {
    if (ALLOWED_KEYS.has(key)) safeUpdate[key] = body.formData[key];
  }

  if (Object.keys(safeUpdate).length === 0) {
    return NextResponse.json({ error: "No allowed fields" }, { status: 400 });
  }

  await patchFormData(c.id, safeUpdate);

  if (body.completed) {
    logActivity({ action: "intake.completed", caseId: c.id, caseTitle: c.title });
  }

  return NextResponse.json({ ok: true });
}

export const GET = withRoute(_GET);
export const POST = withRoute(_POST);
