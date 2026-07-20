import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, faqSchema, attorneyServiceSchema } from "@/components/seo/schemas";
import { canonical } from "@/lib/seo";
import { AttorneyApplicationForm } from "./AttorneyApplicationForm";

{/* NEEDS FOUNDER REVIEW — repositioned to triage-infra narrative */}
const TITLE = "For EB-2 NIW Attorneys — NIW Triage & First-Draft Infrastructure";
const DESCRIPTION =
  "PetitionHQ helps immigration firms pre-screen NIW prospects and generate first drafts faster. Fewer junk consults, faster inquiry-to-retainer, higher-quality NIW packets.";
const PATH = "/for-attorneys";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "EB-2 NIW attorney lead generation",
    "NIW client intake",
    "immigration practice growth",
    "pre-screened NIW clients",
    "Dhanasar prong analysis",
  ],
  alternates: { canonical: canonical(PATH) },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonical(PATH), type: "article" },
};

const FAQS = [
  {
    q: "What does a PetitionHQ lead actually include?",
    a: "Each lead is a structured intake packet: applicant credentials and timeline, USCIS-aligned tier rating, prong-by-prong Dhanasar scoring with narrative, AI-drafted first-pass brief sections, exhibit plan, citation table, and recommender-letter outlines. The first thirty minutes of a typical NIW intake — degree verification, publication count, citation review, field assessment — are already done.",
  },
  {
    q: "How is lead quality controlled?",
    a: "Every applicant completes the structured eligibility assessment before reaching attorneys. Borderline and not-yet-ready cases are filtered out by default — attorneys see only Promising and Strong tiered cases unless the applicant explicitly opts in to a second-opinion review. We would rather send fewer leads than send junk.",
  },
  {
    q: "What is the commercial model?",
    a: "$99/month for platform access, $150 per prospect you choose to claim. If the applicant doesn't complete intake within 14 days, the $150 is automatically refunded — no paperwork. If a claimed lead turns out to have materially misrepresented their profile, you can request a refund within 30 days. Applicants never pay us a referral fee — they retain you directly under your standard engagement letter, and PetitionHQ takes no contingent or success-based cut.",
  },
  {
    q: "How do I know the applicant is real?",
    a: "Every prospect is identity-anchored against 7+ public databases — OpenAlex, ORCID, ROR, NSF, NIH, USPTO, and Crossref — before it reaches you. We resolve one real person, drop namesakes, and corroborate their claimed credentials against independent sources. Each lead carries a corroboration score, and only leads scoring 60 or above are visible to attorneys. See the full methodology on our verification page.",
  },
  {
    q: "Do you compete with attorneys?",
    a: "No. PetitionHQ is software. We do not file petitions, do not give legal advice, and do not hold ourselves out as a law firm. Every applicant who proceeds beyond assessment engages a licensed U.S. immigration attorney for representation.",
  },
  {
    q: "What about other visa categories?",
    a: "PetitionHQ is currently EB-2 NIW only. EB-1A and O-1 are on the roadmap. If your practice covers those categories, you can register your interest now — when we launch, partners with existing NIW relationships will get first pick of matched leads.",
  },
];

export default function ForAttorneysPage() {
  return (
    <article className="mx-auto max-w-4xl">
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "For Attorneys", path: PATH }])} />
      <JsonLd data={faqSchema(FAQS)} />
      <JsonLd data={attorneyServiceSchema()} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">For Attorneys</span>
      </nav>

      <header className="mb-10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">For EB-2 NIW attorneys</p>
          <Link href="#apply" className="btn btn-primary text-sm shrink-0">Apply to partner network →</Link>
        </div>
        {/* NEEDS FOUNDER REVIEW — hero copy */}
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
          Pre-screen NIW prospects. Generate first drafts faster. Stop wasting 40 hours a month on tire-kickers.
        </h1>
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          PetitionHQ is NIW intake, triage, and first-draft infrastructure for immigration firms.
          Prospects arrive pre-scored against the Dhanasar framework with an exhibit plan, citation table, and draft brief opening.
          You evaluate fit in five minutes. Your team focuses on legal judgment — not data entry.
        </p>
      </header>

      {/* NEEDS FOUNDER REVIEW — three-promises framing */}
      <section className="grid gap-6 grid-cols-1 md:grid-cols-3">
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Fewer junk consults</p>
          <p className="mt-2 font-serif text-xl font-bold text-text-primary">Pre-screened against Dhanasar</p>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Borderline and not-yet-ready cases are filtered before you see them. You only evaluate prospects that have already passed an honest, framework-based screen.
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Faster inquiry → retainer</p>
          <p className="mt-2 font-serif text-xl font-bold text-text-primary">~5 min to evaluate fit</p>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            Every prospect arrives with prong-level scoring, citation table, and exhibit plan. The first 30–60 minutes of a typical NIW intake are already done before you pick up the phone.
          </p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Higher-quality NIW packets</p>
          <p className="mt-2 font-serif text-xl font-bold text-text-primary">First draft ready on claim</p>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed">
            AI-drafted brief opening, exhibit plan, and recommender outlines grounded in the applicant&rsquo;s real, corroborated credentials. Your team edits — it doesn&rsquo;t start from scratch.
          </p>
        </div>
      </section>

      {/* What you actually receive per lead */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-4 text-text-primary">What you receive per lead</h2>
        <ul className="space-y-3 text-text-secondary leading-relaxed">
          {[
            "Tier rating (Strong / Promising) with overall case-strength score",
            "Prong-by-prong Dhanasar narrative — substantial merit, well-positioned, on-balance benefit",
            "Citation table: total citations, h-index, field-normalized percentile where available",
            "Structured publication record + co-author vs independent author breakdown",
            "Awards, grants, peer-review, and prior-funding evidence",
            "Proposed U.S. endeavor with documentation of national priority where applicable",
            "Exhibit plan + recommender-letter outlines tailored to applicant profile",
            "AI-drafted opening section of the petition brief (your judgment, faster)",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <span className="mt-1 inline-block h-2 w-2 rounded-full bg-brand-primary" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* NEEDS FOUNDER REVIEW — demo card copy */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-2 text-text-primary">What a publicly corroborated prospect looks like</h2>
        <p className="text-sm text-text-secondary mb-6">
          The triage view before you claim. Applicant identity is kept anonymous until you claim.
        </p>
        <div className="rounded-xl border border-border-default bg-surface-card px-4 py-4 sm:px-6 flex flex-col gap-3 relative">
          <span className="absolute top-3 right-3 text-xs font-medium text-text-muted bg-surface-subtle rounded-full px-2 py-0.5">Demo</span>
          {/* Card header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-success">Tier 1 — Strong</span>
                <span className="badge badge-info">New this week</span>
                <span className="text-sm font-medium text-text-secondary">Machine Learning</span>
                <span className="text-xs text-text-muted">PhD · 6y exp</span>
                {/* Trust chip */}
                <span className="rounded-full px-2 py-0.5 text-xs font-bold bg-success-soft text-success-text">
                  Trust: 85/100
                </span>
              </div>
              <div className="text-xs text-text-muted flex gap-3 flex-wrap">
                <span>Pubs: <strong className="text-text-secondary">8</strong></span>
                <span>Citations: <strong className="text-text-secondary">210</strong></span>
                <span className="text-warning-text">Awards: Best Paper Award</span>
                <span className="text-info-text">Grants: NSF CAREER</span>
                <span className="text-text-muted">Captured 2d ago</span>
              </div>
            </div>
            <span className="btn btn-secondary text-sm shrink-0 cursor-default opacity-60">Review →</span>
          </div>
          {/* Verification badges */}
          <div className="border-t border-border-subtle pt-2.5 space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
              {[
                "8 publications corroborated (OpenAlex)",
                "Institution corroborated",
                "NSF CAREER Award corroborated",
              ].map((label) => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full bg-success-bg border border-success-border px-2.5 py-0.5 text-xs text-success-text">
                  <span className="text-success-fill" aria-hidden>✓</span>
                  {label}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg border border-warning-border px-2.5 py-0.5 text-xs text-warning-text">
                <span aria-hidden>⚠</span>
                Best Paper Award (self-reported)
              </span>
            </div>
          </div>
          {/* Annotation callouts */}
          <div className="border-t border-border-subtle pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* NEEDS FOUNDER REVIEW */}
            {[
              { label: "Trust score", body: "Identity anchored against 7+ public databases. Only leads ≥ 60 reach you." },
              { label: "Corroboration badges", body: "Green = independently corroborated from public sources. Yellow = applicant-stated, not independently confirmed." },
              { label: "Tier 1 — Strong", body: "Passed the Dhanasar prong screen. Borderline and Not-yet-ready cases are filtered before you see them." },
            ].map(({ label, body }) => (
              <div key={label} className="rounded-lg bg-surface-subtle px-3 py-2.5 text-xs">
                <p className="font-semibold text-text-primary mb-0.5">{label}</p>
                <p className="text-text-secondary leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing table */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-2 text-text-primary">Simple, transparent pricing</h2>
        <p className="text-sm text-text-secondary mb-6">No hidden fees. No contingency cuts. Applicants never pay us anything.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Platform access</p>
              <p className="mt-1 font-serif text-3xl font-bold text-text-primary">$99<span className="text-lg font-normal text-text-secondary">/mo</span></p>
            </div>
            <ul className="space-y-2 text-sm text-text-secondary">
              {[
                "Full access — browse all available prospects",
                "Lead preview: tier, score, field, trust chip, corroboration badges",
                "Instant notification on new Tier 1 leads in your fields",
                "Cancel anytime — no contracts",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-success-text mt-0.5 shrink-0" aria-hidden>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card ring-2 ring-brand-primary space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Per claim</p>
              <p className="mt-1 font-serif text-3xl font-bold text-text-primary">$150<span className="text-lg font-normal text-text-secondary"> flat</span></p>
            </div>
            <ul className="space-y-2 text-sm text-text-secondary">
              {[
                "Full 8-page dossier: prong narrative, exhibit plan, brief draft",
                "Applicant contact details unlock on claim",
                "Auto-refunded if applicant doesn't complete intake in 14 days",
                "Refundable within 30 days for material misrepresentation",
                "No referral fee, no success fee, no contingency",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-success-text mt-0.5 shrink-0" aria-hidden>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Risk-reversal strip */}
      <section className="mt-8">
        <div className="rounded-xl bg-surface-subtle border border-border-default px-6 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-text-secondary">
          {[
            { icon: "🔄", label: "14-day ghost auto-refund", body: "Applicant doesn't complete intake? Full refund. No paperwork." },
            { icon: "🛡", label: "30-day misrep refund", body: "Claimed lead materially misrepresented? Request refund within 30 days." },
            { icon: "0%", label: "No contingency", body: "PetitionHQ takes zero cut of your fees. You retain the client directly." },
          ].map(({ icon, label, body }) => (
            <div key={label} className="flex items-start gap-3 min-w-[200px]">
              <span className="text-base shrink-0" aria-hidden>{icon}</span>
              <div>
                <p className="font-semibold text-text-primary text-xs">{label}</p>
                <p className="text-xs text-text-muted leading-snug">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works for the firm */}
      <section className="mt-16">
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-4 text-text-primary">How it works for your firm</h2>
        <ol className="list-decimal pl-6 space-y-2 text-text-secondary leading-relaxed">
          <li>Apply to the partner network. We verify state-bar standing and confirm NIW practice fit.</li>
          <li>Set your profile: fields of expertise, geography, capacity, fee range.</li>
          <li>Matched leads arrive with the full intake packet. You evaluate fit in five minutes.</li>
          <li>Accept the match, send your engagement letter, and own the client relationship from there.</li>
        </ol>
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-2xl font-bold tracking-tight mb-4 text-text-primary">Attorney FAQ</h2>
        <div className="space-y-4">
          {FAQS.map((f) => (
            <details key={f.q} className="card group">
              <summary className="cursor-pointer list-none font-serif text-lg font-semibold text-text-primary">
                <span className="flex items-center justify-between gap-4">
                  {f.q}
                  <span className="text-text-muted group-open:rotate-45 transition-transform" aria-hidden>+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          Want the full scoring methodology?{" "}
          <Link href="/verification" className="font-medium text-text-primary underline">
            See how we verify applicants &rarr;
          </Link>
        </p>
      </section>

      {/* ────────── Application form ────────── */}
      <section id="apply" className="mt-16 rounded-2xl bg-surface-inverted px-6 py-10 sm:px-12">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-text-inverted">Apply to the partner network</h2>
        <p className="mt-2 text-text-inverted opacity-75">
          We are onboarding a small number of boutique NIW firms each month. Fill out the form below and we will be in touch within two business days.
        </p>
        <div className="mt-8">
          <AttorneyApplicationForm />
        </div>
      </section>
    </article>
  );
}
