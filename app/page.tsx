import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  serviceSchema,
  softwareApplicationSchema,
  faqSchema,
  howToSchema,
} from "@/components/seo/schemas";
import { BRAND, SITE_URL, canonical } from "@/lib/seo";

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  alternates: { canonical: canonical("/") },
  openGraph: {
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    url: SITE_URL,
    type: "website",
  },
};

const HOMEPAGE_FAQS = [
  {
    q: "Is the assessment really free?",
    a: "Yes — tier rating, Dhanasar prong-level gap analysis, and pathway recommendation. No credit card, no account required. You only pay if you choose to engage a partner attorney.",
  },
  {
    q: "How is the assessment scored?",
    a: "Directly against the three Matter of Dhanasar prongs — the controlling USCIS framework for EB-2 NIW adjudication. Each prong is evaluated against evidence patterns USCIS has historically rewarded: publications, citations, recommender letters, grants, awards, peer-review activity, and the specificity of your proposed U.S. endeavor.",
  },
  {
    q: "How honest is the tier rating?",
    a: "About one in three applicants receive a 'Not yet ready' or 'Borderline' tier with concrete guidance on which evidence to build before filing. We would rather lose you to an honest result today than file a petition that gets denied.",
  },
  {
    q: "Is my data secure?",
    a: "Encrypted at rest, HTTPS with HSTS, JWT sessions with server-side revocation. Nothing is shared with attorneys or third parties without your explicit consent. We do not use your data to train AI models.",
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    name: "Answer 5 minutes of questions",
    text: "Degree, field, publications, citations, awards, grants, and your intended U.S. endeavor. No payment or account required.",
  },
  {
    name: "Get your honest tier rating",
    text: "Scored against the three Matter of Dhanasar prongs. Includes a prong-level gap analysis identifying where your case is strongest and weakest.",
  },
  {
    name: "See your biggest gap — and how to fix it",
    text: "A prong-level read of where your case is strong, weak, or not ready — and what stronger cases usually have. Before you spend a dollar on filing.",
  },
  {
    name: "Optional: match with a vetted attorney",
    text: "Only if you want it — you decide after seeing your result. Nothing is shared without your explicit consent.",
  },
];

export default function RootPage() {
  return (
    <>
      <JsonLd data={serviceSchema()} />
      <JsonLd data={softwareApplicationSchema()} />
      <JsonLd data={faqSchema(HOMEPAGE_FAQS)} />
      <JsonLd
        data={howToSchema({
          name: "How to assess your EB-2 NIW case strength with PetitionHQ",
          description:
            "Four steps from a free five-minute EB-2 NIW case-strength assessment to an attorney-ready evidence dossier.",
          steps: HOW_IT_WORKS_STEPS,
        })}
      />

      <article className="space-y-20">
        {/* ────────── Hero ────────── */}
        <section className="mx-auto max-w-5xl pt-8 sm:pt-12">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-10 lg:gap-16 items-center">

            {/* Left: copy */}
            <div>
              <p className="mb-4 inline-block rounded-full bg-surface-muted px-3 py-1 text-xs font-medium tracking-wide text-text-secondary uppercase">
                EB-2 National Interest Waiver
              </p>
              <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight mb-4 text-text-primary">
                Almost half of NIW petitions now get denied. Find out which half you&apos;re in.
              </h1>
              <p className="text-lg text-text-secondary mb-6 leading-relaxed">
                Free 5-minute credential check against the USCIS Dhanasar framework.
                We verify your real publication record — and tell you exactly where your case is weak,
                including &ldquo;not yet.&rdquo;
              </p>

              <Link
                href="/check"
                className="btn btn-primary btn-lg text-lg font-semibold px-10"
              >
                Check my NIW odds — free
              </Link>
              <p className="mt-3 text-sm text-text-muted">5 min · No account · No sales call</p>

              {/* Proof strip — true numbers only, no invented counts */}
              <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="text-success-fill" aria-hidden>●</span>
                  1 in 3 assessments returns &ldquo;not yet&rdquo;
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-success-fill" aria-hidden>●</span>
                  11 public databases cross-checked
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-success-fill" aria-hidden>●</span>
                  Free &amp; private — no sales call
                </span>
              </div>
            </div>

            {/* Right: CSS-built product proof card (desktop only) */}
            <div className="relative hidden lg:block w-[320px] shrink-0" aria-hidden="true">
              <div className="rounded-2xl border border-border-default bg-surface-card shadow-lg p-5 space-y-4">
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">NIW Assessment</p>
                    <p className="font-serif text-2xl font-bold text-text-primary mt-0.5">Promising</p>
                  </div>
                  <div className="rounded-xl bg-success-bg border border-success-border px-3 py-1.5 text-center min-w-[64px]">
                    <p className="text-[10px] text-text-muted">Trust</p>
                    <p className="text-xl font-bold tabular-nums text-success-text leading-none">
                      72<span className="text-xs font-normal text-text-muted">/100</span>
                    </p>
                  </div>
                </div>

                {/* Score bar with 60-point gate */}
                <div className="relative">
                  <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                    <div className="h-full rounded-full bg-success-fill transition-all" style={{ width: "72%" }} />
                  </div>
                  {/* 60-point threshold tick */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-warning-border"
                    style={{ left: "60%" }}
                    title="Attorney-ready threshold"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-[9px] text-text-muted">0</span>
                    <span className="text-[9px] text-warning-text font-medium" style={{ marginLeft: "55%" }}>60 threshold</span>
                  </div>
                </div>

                {/* Verification claim rows */}
                <div className="space-y-1.5">
                  {[
                    { label: "Identity", note: "ORCID confirmed" },
                    { label: "Publications", note: "4 confirmed via Crossref" },
                    { label: "Institution", note: "ROR match — NYU" },
                    { label: "Citations", note: "118 tracked" },
                  ].map(({ label, note }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{label}</span>
                      <span className="flex items-center gap-1 text-success-text font-medium">
                        <svg viewBox="0 0 12 12" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                        </svg>
                        {note}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Gap callout */}
                <div className="rounded-lg bg-warning-bg border border-warning-border px-3 py-2 text-xs">
                  <p className="font-semibold text-warning-text">Gap: Recommender letters</p>
                  <p className="mt-0.5 text-text-secondary leading-relaxed">
                    Add 2 U.S.-based recommenders to clear the attorney-ready threshold.
                  </p>
                </div>
              </div>

              {/* Decorative glow */}
              <div className="pointer-events-none absolute -bottom-6 -right-6 h-40 w-40 rounded-full bg-success-fill opacity-5 blur-3xl" />
            </div>
          </div>
        </section>

        {/* ────────── The bar moved (reality hook) ────────── */}
        <section className="mx-auto max-w-4xl rounded-2xl bg-surface-inverted px-6 py-10 sm:px-12 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-text-inverted">
            The bar moved. Most people don&apos;t know it.
          </h2>
          <div className="mt-8 grid gap-8 grid-cols-1 sm:grid-cols-3">
            <div>
              <p className="font-serif text-3xl sm:text-4xl font-bold text-text-inverted">~80% → ~36%</p>
              <p className="mt-2 text-sm text-text-inverted opacity-70 leading-relaxed">NIW approval rate, FY2023 → late FY2025 — the first time on record USCIS denied more petitions than it approved.</p>
            </div>
            <div>
              <p className="font-serif text-3xl sm:text-4xl font-bold text-text-inverted">~1 in 2</p>
              <p className="mt-2 text-sm text-text-inverted opacity-70 leading-relaxed">NIW petitions now draw a Request for Evidence. RFEs are the norm, not the exception.</p>
            </div>
            <div>
              <p className="font-serif text-3xl sm:text-4xl font-bold text-text-inverted">$15K+</p>
              <p className="mt-2 text-sm text-text-inverted opacity-70 leading-relaxed">on the line if you file before you&apos;re ready — plus 6+ months lost to a denial.</p>
            </div>
          </div>
          <p className="mt-8 text-xs text-text-inverted opacity-60">
            Source: USCIS EB-2 NIW adjudication data, FY2023–2025. We score your real record against the new reality — free, in 5 minutes.
          </p>
          <div className="mt-6">
            <Link href="/check" className="btn btn-inverted">Check where I stand →</Link>
          </div>
        </section>

        {/* ────────── Cost comparison ────────── */}
        <section className="mx-auto max-w-5xl">
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-3 text-center">
            <div className="card">
              <p className="font-serif text-3xl font-bold text-text-primary">$300–$500</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">Typical NIW consultation</p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                To find out if your case is even worth filing — after the attorney has already pitched you on retaining them.
              </p>
            </div>
            <div className="card ring-2 ring-brand-primary">
              <p className="font-serif text-3xl font-bold text-text-primary">$0</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">PetitionHQ assessment</p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                Five minutes. Scored against the same Dhanasar framework. No pitch. Honest tier — including &quot;not yet.&quot;
              </p>
            </div>
            <div className="card">
              <p className="font-serif text-3xl font-bold text-text-primary">$6–15K</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-text-muted">EB-2 NIW total cost</p>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                Attorney fees + USCIS filing fees once you commit. Worth knowing if your case is ready first.
              </p>
            </div>
          </div>
        </section>

        {/* ────────── How it works ────────── */}
        <section className="mx-auto max-w-4xl">
          <h2 className="font-serif text-3xl font-bold tracking-tight mb-8 text-center text-text-primary">How it works</h2>
          <ol className="grid gap-6 grid-cols-1 sm:grid-cols-2">
            {HOW_IT_WORKS_STEPS.map((step, i) => (
              <li key={step.name} className="card">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Step {i + 1}</p>
                <p className="mt-1 font-serif text-lg font-bold text-text-primary">{step.name}</p>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Link href="/check" className="btn btn-primary">Start step 1 — free assessment</Link>
          </div>
        </section>

        {/* ────────── Who this is for ────────── */}
        <section className="mx-auto max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-bold tracking-tight text-text-primary">Who NIW is for</h2>
            <p className="mt-2 text-text-secondary max-w-2xl mx-auto">
              The National Interest Waiver rewards advanced-degree professionals with demonstrable national-level impact.
            </p>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: "Researchers & scientists", body: "Peer-reviewed publications and citations in U.S. priority fields: biotech, climate, AI, materials, semiconductors." },
              { title: "Engineers & technologists", body: "Patents, open-source impact, or systems deployed at scale in ML/AI, cybersecurity, semiconductors, robotics." },
              { title: "Healthcare professionals", body: "Physicians, nurse-scientists, and biomedical engineers addressing U.S. healthcare-shortage priorities." },
              { title: "Founders & operators", body: "Technical founders with funding, traction, or category-defining IP in tech, healthcare, climate, or defense." },
            ].map((p) => (
              <div key={p.title} className="card">
                <p className="font-serif text-lg font-bold text-text-primary">{p.title}</p>
                <p className="mt-2 text-sm text-text-secondary leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-text-muted text-center">
            Not in these categories? Take the assessment anyway — NIW has been approved across dozens of fields.
          </p>
        </section>

        {/* ────────── FAQ ────────── */}
        <section className="mx-auto max-w-4xl">
          <h2 className="font-serif text-3xl font-bold tracking-tight mb-6 text-center text-text-primary">FAQ</h2>
          <div className="space-y-3">
            {HOMEPAGE_FAQS.map((f) => (
              <details key={f.q} className="card group">
                <summary className="cursor-pointer list-none font-serif text-lg font-semibold text-text-primary marker:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {f.q}
                    <span className="text-text-muted group-open:rotate-45 transition-transform" aria-hidden>+</span>
                  </span>
                </summary>
                <p className="mt-3 text-sm text-text-secondary leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/faq" className="text-sm font-semibold text-text-primary hover:underline">
              See all FAQs →
            </Link>
          </div>
        </section>

        {/* ────────── Final CTA ────────── */}
        <section className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-3xl font-bold tracking-tight mb-3 text-text-primary">
            Find out where your case actually stands.
          </h2>
          <p className="text-text-secondary mb-5">
            Five minutes. No credit card. Honest answer — including &quot;not yet.&quot;
          </p>
          <Link
            href="/check"
            className="btn btn-primary btn-lg text-lg font-semibold px-10"
          >
            Start my free assessment
          </Link>
        </section>
      </article>
    </>
  );
}
