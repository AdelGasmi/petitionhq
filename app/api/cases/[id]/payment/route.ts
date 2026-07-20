import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_STATUSES = ["unpaid", "invoiced", "paid"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try { await requireAdmin(); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { id: caseId } = await params;
  const { paymentStatus, paymentNotes } = await req.json();

  if (paymentStatus && !VALID_STATUSES.includes(paymentStatus))
    return NextResponse.json({ error: "Invalid payment status." }, { status: 400 });

  const updated = await prisma.case.update({
    where: { id: caseId },
    data: {
      ...(paymentStatus !== undefined && { paymentStatus }),
      ...(paymentNotes !== undefined && { paymentNotes: paymentNotes || null }),
    },
    select: { id: true, paymentStatus: true, paymentNotes: true },
  });

  return NextResponse.json(updated);
}
