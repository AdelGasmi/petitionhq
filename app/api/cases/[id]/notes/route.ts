import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  void admin;

  const { id: caseId } = await params;
  const notes = await prisma.caseNote.findMany({
    where: { caseId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try { admin = await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id: caseId } = await params;
  const { text } = await req.json();
  if (!text?.trim()) return NextResponse.json({ error: "Note text is required." }, { status: 400 });

  const note = await prisma.caseNote.create({
    data: { caseId, authorId: admin.userId, authorName: admin.name, text: text.trim() },
  });
  return NextResponse.json({ ...note, createdAt: note.createdAt.toISOString() }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { noteId } = await req.json();
  if (!noteId) return NextResponse.json({ error: "noteId required." }, { status: 400 });

  await prisma.caseNote.delete({ where: { id: noteId } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
