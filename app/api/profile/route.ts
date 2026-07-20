import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { findUserById, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try { session = await requireSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const user = await findUserById(session.userId);
  if (!user) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    plan: user.plan,
    createdAt: user.createdAt,
  });
}

export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { name, phone } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required." }, { status: 400 });

  await updateUser(session.userId, {
    name: name.trim(),
    ...(phone !== undefined && { phone: phone.trim() || null }),
  });

  return NextResponse.json({ ok: true });
}
