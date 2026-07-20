import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { setUserPlan, findUserById } from "@/lib/users";
import { createCase } from "@/lib/db";
import { getForm } from "@/forms";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  const { plan, formId } = await req.json();

  const validPlans = ["starter", "professional", "premium"];
  if (!plan || !validPlans.includes(plan))
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });

  if (!formId || !getForm(formId))
    return NextResponse.json({ error: "Invalid form." }, { status: 400 });

  const user = await findUserById(session.userId);
  if (!user) return NextResponse.json({ error: "User not found." }, { status: 404 });

  await setUserPlan(session.userId, plan);

  const form = getForm(formId)!;
  const c = await createCase({
    formId,
    title: `${user.name} — ${form.shortTitle}`,
    ownerId: session.userId,
  });

  return NextResponse.json({ caseId: c.id });
}
