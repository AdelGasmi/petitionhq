import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession, canManageCase } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function _PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const c = await prisma.case.findUnique({
    where: { id },
    select: { id: true, ownerId: true, attorneyId: true },
  });
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canManageCase(session, { id: c.id, ownerId: c.ownerId ?? undefined, attorneyId: c.attorneyId ?? undefined })) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    nextFollowUp?: string | null;
    nextAction?: string | null;
  };

  await prisma.case.update({
    where: { id },
    data: {
      nextFollowUp: body.nextFollowUp ? new Date(body.nextFollowUp) : null,
      nextAction: body.nextAction ?? null,
    },
  });

  return NextResponse.json({ ok: true });
}

export const PUT = withRoute(_PUT);
