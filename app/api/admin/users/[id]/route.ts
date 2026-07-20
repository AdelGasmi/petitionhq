import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth";
import { findUserById, updateUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** PATCH — update name, email, role, or reset password */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id } = await params;
  const user = await findUserById(id);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json();
  const updates: Parameters<typeof updateUser>[1] = {};

  if (body.name?.trim())  updates.name  = body.name.trim();
  if (body.email?.trim()) updates.email = body.email.trim().toLowerCase();
  if (body.role && ["admin", "attorney", "applicant"].includes(body.role)) {
    if (id === session.userId && body.role !== "admin") {
      return NextResponse.json(
        { error: "Admins cannot demote themselves. Ask another admin." },
        { status: 403 },
      );
    }
    updates.role = body.role;
  }

  if (body.password) {
    if (body.password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    updates.passwordHash = await bcrypt.hash(body.password, 12);
  }

  if (Object.keys(updates).length === 0)
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  try {
    const updated = await updateUser(id, updates);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Update failed." },
      { status: 409 }
    );
  }
}
