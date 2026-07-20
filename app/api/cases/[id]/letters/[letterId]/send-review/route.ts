import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, createLetterReviewToken } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";
import { sendReviewInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; letterId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, letterId } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const letter = c.letters[letterId];
  if (!letter) return NextResponse.json({ error: "Letter not found" }, { status: 404 });

  const { email } = await req.json();
  const to = (email ?? letter.recommender.email ?? "").trim();
  if (!to) return NextResponse.json({ error: "Recommender email required" }, { status: 400 });

  const token = await createLetterReviewToken(letterId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const reviewUrl = `${baseUrl}/review/${token}`;

  const pi = (c.formData["petitioner-info"] ?? c.formData["petitionerInfo"] ?? {}) as Record<string, unknown>;
  const applicantName = String(pi.fullName ?? "the applicant");

  await sendReviewInviteEmail({
    to,
    recommenderName: letter.recommender.name,
    applicantName,
    letterTitle: letter.requirementId,
    reviewUrl,
  });

  return NextResponse.json({ ok: true, reviewUrl });
}

export const POST = withRoute(_POST);
