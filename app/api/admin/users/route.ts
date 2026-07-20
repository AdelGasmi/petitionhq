import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createUser, listUsers, deleteUser, findUserById } from "@/lib/users";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

export async function GET() {
  try { await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  const users = await listUsers();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { email, password, name, role } = await req.json();
  if (!email || !password || !name || !role)
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  if (role !== "admin" && role !== "attorney" && role !== "applicant")
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await createUser({ email, passwordHash, name, role, verified: true });
    logActivity({ actor: admin, action: "user.created", detail: `${name} (${role})` });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create user." },
      { status: 409 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "User id required." }, { status: 400 });
  if (id === admin.userId) {
    return NextResponse.json(
      { error: "Admins cannot delete themselves. Ask another admin." },
      { status: 403 },
    );
  }

  const user = await findUserById(id);
  await deleteUser(id);
  logActivity({ actor: admin, action: "user.deleted", detail: user ? `${user.name} (${user.role})` : id });
  return NextResponse.json({ ok: true });
}
