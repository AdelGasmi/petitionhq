import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DraftingRulesEditor } from "./DraftingRulesEditor";
import type { DraftingRules } from "@/app/api/attorney-rules/route";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    redirect("/login");
  }

  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
    select: { draftingRules: true },
  });

  const rules = (firm?.draftingRules ?? {}) as DraftingRules;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Drafting rules & standards</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Define your standards for each section of recommendation letters and petition drafts. These rules are injected into the AI drafting prompts for every case you work on.
        </p>
      </div>

      <DraftingRulesEditor initialRules={rules} />
    </div>
  );
}
