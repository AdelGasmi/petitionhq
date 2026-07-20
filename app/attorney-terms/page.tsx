import type { Metadata } from "next";
import { AttorneyTermsContent } from "@/components/network/AttorneyTermsContent";

export const metadata: Metadata = {
  title: "Attorney Platform Terms — PetitionHQ",
  description:
    "Terms governing attorney and law-firm use of the PetitionHQ platform: lead introductions, drafting tools, verification reports, and data handling.",
};

export default function AttorneyTermsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 py-10">
      <header>
        <div className="text-xs font-medium uppercase tracking-wider text-text-muted">Legal</div>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">Attorney Platform Terms</h1>
      </header>
      <AttorneyTermsContent />
    </div>
  );
}
