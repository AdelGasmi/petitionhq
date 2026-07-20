import Link from "next/link";
import { notFound } from "next/navigation";
import { getForm } from "@/forms";

export default async function FormDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const form = getForm(id);
  if (!form) notFound();

  return (
    <div className="space-y-8">
      <div>
        <Link href="/" className="text-sm text-text-muted hover:text-text-primary">
          ← All forms
        </Link>
      </div>

      <header className="space-y-3">
        <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
          Form {form.formNumber}
        </div>
        <h1 className="font-serif text-4xl tracking-tight">{form.title}</h1>
        <p className="max-w-3xl text-text-secondary">{form.description}</p>
      </header>

      {form.advisories && form.advisories.length > 0 && (
        <div className="rounded-lg border border-warning-border bg-warning-bg p-4">
          <div className="mb-2 text-sm font-semibold text-warning-text">Before you start</div>
          <ul className="space-y-1 text-sm text-warning-text">
            {form.advisories.map((a, i) => (
              <li key={i}>• {a}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-text-muted">Filing fee</div>
          <div className="mt-1 font-serif text-2xl">${form.filingFee.uscisFee}</div>
          {form.filingFee.premiumProcessingFee && (
            <div className="mt-1 text-xs text-text-muted">
              Premium: +${form.filingFee.premiumProcessingFee}
            </div>
          )}
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-text-muted">Processing time</div>
          <div className="mt-1 font-serif text-2xl">~{form.processing.medianMonths} mo</div>
          {form.processing.premiumEligible && form.processing.premiumDays && (
            <div className="mt-1 text-xs text-text-muted">
              Premium: {form.processing.premiumDays} days
            </div>
          )}
        </div>
        <div className="card">
          <div className="text-xs uppercase tracking-wider text-text-muted">Service centers</div>
          <div className="mt-1 text-sm">{form.processing.serviceCenters.join(", ")}</div>
        </div>
      </div>

      <Section title="Eligibility requirements">
        <ul className="space-y-3">
          {form.eligibility.map((rule) => (
            <li key={rule.id} className="card">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    rule.severity === "must"
                      ? "bg-danger-bg text-danger-text"
                      : "bg-warning-bg text-warning-text"
                  }`}
                >
                  {rule.severity === "must" ? "Required" : "Advisory"}
                </span>
                <div className="flex-1">
                  <div className="font-medium">{rule.label}</div>
                  <div className="mt-1 text-sm text-text-secondary">{rule.explanation}</div>
                  {rule.framework && (
                    <div className="mt-2 text-xs text-text-muted">
                      {rule.framework.name}
                      {rule.framework.prong ? ` • Prong ${rule.framework.prong}` : ""}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={`Form sections (${form.sections.length})`}>
        <div className="grid gap-3 md:grid-cols-2">
          {form.sections.map((s) => (
            <div key={s.id} className="card">
              <div className="font-medium">{s.title}</div>
              {s.description && (
                <div className="mt-1 text-sm text-text-secondary">{s.description}</div>
              )}
              <div className="mt-3 text-xs text-text-muted">{s.fields.length} fields</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Required evidence (${form.documents.filter((d) => d.required).length} of ${form.documents.length})`}>
        <ul className="space-y-2">
          {form.documents.map((doc) => (
            <li key={doc.id} className="card flex items-start gap-3">
              <div
                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                  doc.required ? "bg-danger-fill" : "bg-surface-muted"
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{doc.title}</span>
                  {doc.prong && (
                    <span className="rounded bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">
                      Prong {doc.prong}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm text-text-secondary">{doc.description}</div>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {form.letters.length > 0 && (
        <Section title={`Letters required (${form.letters.length})`}>
          <div className="space-y-3">
            {form.letters.map((letter) => (
              <div key={letter.id} className="card">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{letter.title}</div>
                    <div className="mt-1 text-sm text-text-secondary">{letter.description}</div>
                  </div>
                  {letter.minCount && (
                    <div className="shrink-0 text-right text-xs text-text-muted">
                      {letter.minCount}
                      {letter.maxCount ? `–${letter.maxCount}` : "+"} needed
                    </div>
                  )}
                </div>
                {letter.draftingHints?.mustAddress && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-text-muted hover:text-text-primary">
                      Must address ({letter.draftingHints.mustAddress.length} points)
                    </summary>
                    <ul className="mt-2 space-y-1 pl-4 text-xs text-text-secondary">
                      {letter.draftingHints.mustAddress.map((p, i) => (
                        <li key={i} className="list-disc">{p}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      <div className="rounded-lg border-2 border-brand-primary bg-brand-primary p-6 text-white">
        <div className="font-serif text-2xl tracking-tight">Ready to start your case?</div>
        <p className="mt-2 text-text-disabled">
          You&apos;ll be guided through eligibility, form data, document uploads, and drafting.
        </p>
        <button className="mt-4 rounded bg-surface-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-muted">
          Start {form.shortTitle} case
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
