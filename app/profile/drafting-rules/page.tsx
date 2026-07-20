import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DraftingRulesEditor } from "@/app/network/rules/DraftingRulesEditor";
import type { DraftingRules } from "@/app/api/attorney-rules/route";

export const dynamic = "force-dynamic";

export default async function ApplicantDraftingRulesPage() {
  const session = await getSession();
  if (!session || session.role !== "applicant") redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { selfPetitionerBeta: true, draftingRules: true },
  });
  if (!user?.selfPetitionerBeta) redirect("/profile");

  const rules = (user.draftingRules ?? {}) as DraftingRules;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/profile" className="text-sm text-text-muted hover:text-text-primary">
          ← Profile
        </Link>
      </div>
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Drafting rules & standards</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define your own preferences for each section of your recommendation letters and petition draft — tone,
          what to always include, what to avoid. These are injected into the AI drafting prompts on your case only.
        </p>
      </div>

      <DraftingRulesEditor initialRules={rules} endpoint="/api/profile/drafting-rules" />
    </div>
  );
}
