import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, requestReview, respondToReview } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Applicant submits a review request */
async function _POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the case owner can request review
  if (session.role !== "applicant" || c.ownerId !== session.userId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!c.attorneyId)
    return NextResponse.json({ error: "No attorney assigned yet" }, { status: 400 });

  if (c.reviewStatus === "pending")
    return NextResponse.json({ error: "Review already pending" }, { status: 400 });

  const updated = await requestReview(id);
  return NextResponse.json(updated);
}

/** Attorney or admin accepts or declines */
async function _PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const c = await readCase(id);
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { response, note } = await req.json();
  if (response !== "accepted" && response !== "declined")
    return NextResponse.json({ error: "response must be accepted or declined" }, { status: 400 });

  const updated = await respondToReview(id, response, note);
  return NextResponse.json(updated);
}

export const POST = withRoute(_POST);
export const PATCH = withRoute(_PATCH);
