import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { howToSchema, breadcrumbSchema } from "@/components/seo/schemas";
import { canonical } from "@/lib/seo";

const TITLE = "How PetitionHQ Works — Free NIW Assessment to Filed Petition";
const DESCRIPTION =
  "Five steps from free EB-2 NIW case-strength assessment to a filed petition: tier rating, Dhanasar gap analysis, evidence plan, and attorney matching.";
const PATH = "/how-it-works";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonical(PATH), type: "article" },
};

const STEPS = [
  {
    name: "Take the free 5-minute EB-2 NIW assessment",
    text: "Answer a structured questionnaire covering your degree, field, years of experience, publications, citations, awards, grants, peer-review activity, prior funding, and intended U.S. endeavor. No payment, credit card, or account required to start.",
    detail:
      "We ask the same questions an experienced NIW attorney would in a first consultation — but in five minutes, for free, and with no pitch at the end.",
  },
  {
    name: "Receive your tier rating and Dhanasar-prong gap analysis",
    text: "PetitionHQ scores your profile directly against the three Matter of Dhanasar prongs. You receive an honest tier rating — Strong, Promising, Borderline, or Not yet ready — plus a written narrative explaining your case prong-by-prong and identifying the specific evidence gaps that matter most.",
    detail:
      "Tier ratings are calibrated against real NIW adjudication patterns. We mark cases 'Not yet ready' when they are not ready — including roughly one in three.",
  },
  {
    name: "Build your evidence dossier (optional)",
    text: "If you choose to proceed, PetitionHQ guides you through structured evidence collection: exhibit plan, recommender-letter outlines tailored to your profile, citation table, and prong-level draft brief sections. Every output is grounded in your real credentials.",
    detail:
      "AI assistance has citation-level traceability. No invented publications, no inflated claims, no work your attorney has to undo later.",
  },
  {
    name: "Match with a vetted EB-2 NIW attorney",
    text: "Opt in to be matched with U.S. immigration attorneys whose practice fits your field and case profile. They receive your structured intake packet — Dhanasar prong scoring, evidence table, draft brief sections — and respond with a substantive evaluation.",
    detail:
      "You approve each match. Nothing is shared with any attorney without your explicit, scoped consent. You can also use the dossier with an attorney you already have — the matching step is optional.",
  },
  {
    name: "File with confidence",
    text: "Work with your chosen attorney to file Form I-140 with the NIW request. PetitionHQ retains your dossier, exhibits, comments, and recommender letters in one secure workspace through filing, any RFE response, and approval.",
    detail:
      "All data is encrypted at rest in isolated storage with token-scoped access. Documents stay private to you and the attorney you explicitly engaged.",
  },
];

export default function HowItWorksPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={howToSchema({ name: TITLE, description: DESCRIPTION, steps: STEPS })} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "How it works", path: PATH }])} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">How it works</span>
      </nav>

      <header className="mb-12">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">EB-2 NIW · Five steps</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl font-bold tracking-tight">
          How PetitionHQ works
        </h1>
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          From a free 5-minute assessment to a filed petition, in five steps.
        </p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-primary">Start step 1 — free assessment</Link>
        </div>
      </header>

      <ol className="space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.name} className="rounded-lg border border-border-default bg-surface-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Step {i + 1}</p>
            <h2 className="mt-1 font-serif text-xl font-bold text-text-primary">{s.name}</h2>
            <p className="mt-3 text-text-secondary leading-relaxed">{s.text}</p>
            <p className="mt-3 text-sm italic text-text-muted leading-relaxed border-t border-border-subtle pt-3">{s.detail}</p>
          </li>
        ))}
      </ol>

      <section className="mt-12 text-center">
        <Link href="/check" className="btn btn-primary btn-lg">
          Start step 1 — free NIW assessment
        </Link>
        <p className="mt-3 text-xs text-text-muted">5 minutes · No credit card · Not legal advice</p>
      </section>
    </article>
  );
}
