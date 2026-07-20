import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseJsonBody, BodyTooLargeError } from "@/lib/body-limit";

export const dynamic = "force-dynamic";

export type DraftingRules = {
  letterSections: Record<string, SectionRule>;
  petitionSections: Record<string, SectionRule>;
  globalGuidance: string;
};

export type SectionRule = {
  instructions: string;
  tone?: string;
  mustInclude?: string[];
  avoid?: string[];
};

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
    select: { draftingRules: true },
  });

  const rules = (firm?.draftingRules ?? {}) as DraftingRules;
  return NextResponse.json({ rules });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { rules: DraftingRules };
  try {
    body = await parseJsonBody(req, 4_096);
  } catch (e) {
    if (e instanceof BodyTooLargeError) return NextResponse.json({ error: "Request too large" }, { status: 413 });
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  await prisma.firmProfile.upsert({
    where: { userId: session.userId },
    update: { draftingRules: body.rules as object },
    create: {
      userId: session.userId,
      draftingRules: body.rules as object,
    },
  });

  return NextResponse.json({ ok: true });
}
