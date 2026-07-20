import { NextRequest, NextResponse } from "next/server";
import { getLetterByReviewToken, submitLetterReview } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = await getLetterByReviewToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  return NextResponse.json(payload);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { draft } = await req.json();
  if (!draft?.trim()) return NextResponse.json({ error: "Draft is required" }, { status: 400 });

  const ok = await submitLetterReview(token, draft);
  if (!ok) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
