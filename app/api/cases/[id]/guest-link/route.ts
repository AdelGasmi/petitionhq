import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession, canAccessCase } from "@/lib/auth";
import { readCase, createGuestToken, revokeGuestToken } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Generate (or regenerate) the guest access link for a case.
 * Attorney-only — admin blocked (guest links grant case content access,
 * so only the assigned attorney may create them).
 */
async function _POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "attorney") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { token, expiry } = await createGuestToken(id);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  return NextResponse.json({
    url: `${baseUrl}/guest/${token}`,
    expiry: expiry.toISOString(),
  });
}

/** Revoke the guest access link. Attorney-only. */
async function _DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "attorney") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await revokeGuestToken(id);
  return NextResponse.json({ ok: true });
}

export const POST = withRoute(_POST);
export const DELETE = withRoute(_DELETE);
