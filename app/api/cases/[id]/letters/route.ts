import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { readCase, upsertLetter, newId } from "@/lib/db";
import { getSession, canAccessCase, canDraftCase } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function _POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c))
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!(await canDraftCase(session, c)))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const letterId = newId();
  const letter = {
    id: letterId,
    requirementId: body.requirementId,
    recommender: body.recommender,
    selectedEvidence: body.selectedEvidence ?? [],
    currentDraft: undefined,
    qualityReport: undefined,
    versions: [],
    comments: [],
    reviewInviteSent: false,
    updatedAt: new Date().toISOString(),
  };
  await upsertLetter(id, letter);
  return NextResponse.json({ id: letterId });
}

export const POST = withRoute(_POST);
