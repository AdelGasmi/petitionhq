import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { formsByCategory } from "@/forms";
import type { FormCategory } from "@/forms/types";

export const dynamic = "force-dynamic";

const CATEGORY_LABELS: Record<FormCategory, string> = {
  "employment-based": "Employment-based green cards",
  "family-based": "Family-based petitions",
  "naturalization": "Naturalization",
  "nonimmigrant": "Nonimmigrant visas",
  "adjustment": "Adjustment of status",
};

export default async function FormsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/cases");

  // Applicants are free in Pricing-V2 — anyone authenticated can start a case.
  const grouped = formsByCategory();

  return (
    <div className="space-y-12">
      <section className="space-y-2">
        <h1 className="font-serif text-4xl tracking-tight">Forms catalogue</h1>
        <p className="text-text-muted">
          {session.role === "admin"
            ? "Browse forms and create cases on behalf of clients."
            : "Pick a form below to start a new case."}
        </p>
      </section>

      {Object.entries(grouped).map(([category, forms]) => (
        <section key={category} className="space-y-4">
          <h2 className="font-serif text-2xl tracking-tight">
            {CATEGORY_LABELS[category as FormCategory] ?? category}
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {forms.map((form) => (
              <div key={form.id} className="card card-hover">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
                      Form {form.formNumber}
                    </div>
                    <div className="mt-1 font-serif text-xl tracking-tight">
                      {form.shortTitle}
                    </div>
                    <p className="mt-2 text-sm text-text-secondary">{form.description}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-text-muted">
                    <div>${form.filingFee.uscisFee}</div>
                    <div>~{form.processing.medianMonths} mo</div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Link href={`/cases/new?formId=${form.id}`} className="btn btn-primary">
                    Start case
                  </Link>
                  <Link
                    href={`/forms/${form.id}`}
                    className="text-sm text-text-muted hover:text-text-primary"
                  >
                    Learn more →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
