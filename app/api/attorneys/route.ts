import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await listUsers();
  const attorneys = users
    .filter((u) => u.role === "attorney")
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return NextResponse.json(attorneys);
}
