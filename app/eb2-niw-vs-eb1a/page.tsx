import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, faqSchema, articleSchema } from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";

const PATH = "/eb2-niw-vs-eb1a";
const TITLE = "EB-2 NIW vs EB-1A: The Complete Comparison (2026)";
const DESCRIPTION =
  "EB-2 NIW vs EB-1A side-by-side: eligibility bar, evidence requirements, visa queue, and a decision matrix for which category to file — or both.";

export const metadata: Metadata = {
  title: `${TITLE} — ${BRAND.name}`,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    url: canonical(PATH),
  },
};

const FAQS = [
  {
    q: "Can I apply for EB-1A and EB-2 NIW at the same time?",
    a: "Yes. Filing simultaneous I-140 petitions in multiple categories is legal and common for applicants who may qualify for both. Each petition is adjudicated independently. Filing in both categories hedges against denial in either — though it doubles the filing cost.",
  },
  {
    q: "Is EB-1A harder to get than EB-2 NIW?",
    a: "Generally yes. EB-1A requires demonstrating sustained national or international acclaim across a recognized set of criteria — a higher standard than the EB-2 NIW's three-prong Dhanasar analysis. However, for applicants with very strong international recognition (major prizes, high citation counts, media coverage), EB-1A may actually be easier to document because the evidence is more obvious.",
  },
  {
    q: "Does EB-1A have a priority date advantage over EB-2 NIW?",
    a: "Yes. EB-1A is a first-preference category with a shorter visa queue than EB-2 (second preference). For most countries except India and China, both categories have current priority dates. For India-born applicants, EB-1 and EB-2 have different but both severe backlogs — EB-1 India is generally ahead of EB-2 India.",
  },
  {
    q: "Do I need a job offer for EB-1A or EB-2 NIW?",
    a: "No for both. EB-1A (extraordinary ability) and EB-2 NIW (national interest waiver) are both self-petition categories — no U.S. employer sponsorship or labor certification is required. This makes both categories attractive to researchers, scientists, and professionals seeking green cards independently of a specific employer.",
  },
];

export default function Eb2NiwVsEb1aPage() {
  return (
    <>
      <JsonLd data={articleSchema({
        title: TITLE,
        description: DESCRIPTION,
        path: PATH,
        datePublished: "2026-06-11",
        dateModified: "2026-06-11",
      })} />
      <JsonLd data={breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "EB-2 NIW Guide", path: "/eb2-niw-guide" },
        { name: "EB-2 NIW vs EB-1A", path: PATH },
      ])} />
      <JsonLd data={faqSchema(FAQS)} />

      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-1.5 text-sm text-text-muted flex-wrap">
            <li><Link href="/" className="hover:text-text-primary">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/eb2-niw-guide" className="hover:text-text-primary">EB-2 NIW Guide</Link></li>
            <li aria-hidden>/</li>
            <li className="text-text-secondary">EB-2 NIW vs EB-1A</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
            EB-2 NIW vs EB-1A: The Complete Comparison (2026)
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            Both are self-petition employment-based green cards — no employer sponsorship, no labor
            certification. The difference is the eligibility bar, the evidence strategy, and the
            visa queue. Here is the full comparison.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            By PetitionHQ · Updated June 2026 · 10 min read
          </p>
        </header>

        <div className="prose">
          <h2>The core difference in one sentence</h2>
          <p>
            EB-2 NIW requires demonstrating that your specific proposed work has national importance
            and that you are well-positioned to advance it. EB-1A requires demonstrating sustained
            national or international acclaim in your field — a higher and more abstract standard.
          </p>

          <h2>Side-by-side comparison</h2>
        </div>

        {/* Comparison table */}
        <div className="my-8 overflow-x-auto table-scroll">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="table-header-cell text-left">Factor</th>
                <th className="table-header-cell text-left">EB-2 NIW</th>
                <th className="table-header-cell text-left">EB-1A</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {[
                ["Preference level", "EB-2 (2nd preference)", "EB-1 (1st preference)"],
                ["Eligibility standard", "Three Dhanasar prongs: proposed endeavor with national importance; well-positioned; on balance beneficial", "Sustained national or international acclaim; 3 of 10 evidence criteria (or comparable major award)"],
                ["Job offer required?", "No — self-petition", "No — self-petition"],
                ["Labor certification?", "No — waived by NIW", "No — never required"],
                ["Degree requirement", "Advanced degree (or equivalency)", "None — extraordinary ability in STEM, arts, education, business, or athletics"],
                ["Evidence type", "Proposed-endeavor statement + publications/citations/grants + recommendation letters + national-priority documentation", "Major awards, high citation counts, published media, judging, authorship, original contributions, salary evidence, professional associations, critical role"],
                ["RFE rate (2026)", "~50%", "~35–45%"],
                ["Priority date (most countries)", "Current (no backlog)", "Current (no backlog)"],
                ["Priority date (India)", "~2012 (estimated)", "~2022 (estimated, ahead of EB-2)"],
                ["Typical petition cost", "$5K–$15K total", "$6K–$18K total"],
                ["Who it fits best", "Researchers, scientists, engineers with specific U.S. national-priority work", "Top-tier academics, artists, athletes, executives with international recognition"],
              ].map(([factor, niw, eb1a]) => (
                <tr key={factor as string} className="border-b border-border-subtle">
                  <td className="py-3 pr-4 font-medium text-text-primary align-top">{factor}</td>
                  <td className="py-3 pr-4 align-top">{niw}</td>
                  <td className="py-3 align-top">{eb1a}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="prose">
          <h2>The EB-1A evidence criteria in detail</h2>
          <p>
            EB-1A is adjudicated under a two-step test: (1) does the petitioner meet at least 3 of
            10 evidence criteria, or have a qualifying comparable award? (2) has the petitioner
            achieved sustained national or international acclaim, and is the work at the top of the
            field? USCIS calls this the "final merits determination."
          </p>
          <p>
            The 10 criteria are: prizes or awards for excellence; membership in organizations
            requiring outstanding achievement; published material about the alien in major media;
            judging others' work in the same or allied field; original scientific, scholarly,
            artistic, athletic, or business-related contributions of major significance; authorship
            of scholarly articles in professional journals or major media; display at artistic
            exhibitions or showcases; performing a leading or critical role for distinguished
            organizations; commanding a high salary; and commercial success in the performing arts.
          </p>
          <p>
            Meeting the numeric threshold (3 criteria) is necessary but not sufficient. The final
            merits determination requires showing the full body of evidence rises to "sustained
            acclaim at the top of the field" — which is where many EB-1A petitions that meet the
            criteria count still fail.
          </p>

          <h2>The EB-2 NIW evidence strategy</h2>
          <p>
            EB-2 NIW under <em>Matter of Dhanasar</em> is more forgiving of mid-career applicants
            with strong but not internationally acclaimed records. The three prongs are:
          </p>
          <ol>
            <li><strong>Prong 1:</strong> The proposed endeavor has substantial merit and national importance — documented by tying the work to specific U.S. federal priority programs (NSTC critical technologies list, NIH/NSF priorities, DOE programs, etc.)</li>
            <li><strong>Prong 2:</strong> The petitioner is well-positioned to advance the endeavor — supported by publications, citations, grants, institutional interest, and recommendation letters from independent experts</li>
            <li><strong>Prong 3:</strong> On balance, it is beneficial to the U.S. to waive the job offer requirement — typically argued on urgency, uniqueness, or specific U.S. institutional need</li>
          </ol>
          <p>
            A researcher with 8 publications and 200 citations in a well-documented national-priority
            field (AI safety, biomedical engineering, climate tech) is a plausible NIW candidate.
            The same researcher would struggle with EB-1A's "sustained national acclaim" standard
            without additional recognition signals.
          </p>

          <h2>Which should you file?</h2>
          <p>The decision matrix:</p>
          <ul>
            <li><strong>File EB-2 NIW if:</strong> You have a specific proposed U.S. endeavor in a documented national-priority field; your citation/publication record is solid but not at the "top 1%" level; you are mid-career; your national-priority documentation is strong.</li>
            <li><strong>File EB-1A if:</strong> You have a major internationally recognized award (Nobel, Fields, major prizes), very high citation count (top of field), regular media coverage in national publications, or you're a senior executive at a distinguished organization.</li>
            <li><strong>File both if:</strong> You are ambiguous between the two (strong but not transcendent record) and can afford double fees. The categories are not mutually exclusive, and having two pending petitions hedges against denial in either.</li>
            <li><strong>File EB-2 NIW first if budget-constrained:</strong> NIW petitions are generally less expensive to prepare than EB-1A due to the cleaner prong-by-prong structure and the fact that the proposed-endeavor brief is more tractable than an open-ended "sustained acclaim" argument.</li>
          </ul>

          <h2>The visa queue difference</h2>
          <p>
            For most countries, both categories have current priority dates — meaning no backlog wait
            after I-140 approval. For India-born applicants, both categories have severe backlogs,
            but EB-1 (first preference) is generally ahead of EB-2 (second preference) in the visa
            bulletin. This is the one situation where EB-1A, despite its higher evidentiary bar, may
            be preferable even for applicants who would qualify for both — because the backlog
            timeline difference can be measured in years.
          </p>
        </div>

        {/* Mid-article CTA */}
        <div className="my-10 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
          <p className="text-sm font-semibold text-text-primary mb-2">Not sure which category fits your record?</p>
          <p className="text-sm text-text-secondary mb-4">
            Our free assessment evaluates your profile against the EB-2 NIW Dhanasar prongs — honest result
            including where your record is weak — in 5 minutes.
          </p>
          <Link href="/check" className="btn btn-primary text-sm">Check my EB-2 NIW odds — free</Link>
        </div>

        <div className="prose">
          {/* FAQ */}
          <h2>Frequently asked questions</h2>
        </div>
        <div className="mt-4 space-y-3">
          {FAQS.map((faq) => (
            <details key={faq.q} className="card group">
              <summary className="cursor-pointer list-none font-semibold text-text-primary marker:hidden">
                <span className="flex items-center justify-between gap-4 text-sm">
                  {faq.q}
                  <span className="text-text-muted group-open:rotate-45 transition-transform shrink-0" aria-hidden>+</span>
                </span>
              </summary>
              <p className="mt-3 text-sm text-text-secondary leading-relaxed">{faq.a}</p>
            </details>
          ))}
        </div>

        {/* Related */}
        <div className="mt-12 pt-8 border-t border-border-default">
          <p className="text-sm font-semibold text-text-primary mb-3">Related reading</p>
          <ul className="flex flex-wrap gap-3">
            {[
              { href: "/eb2-niw-guide", label: "EB-2 NIW complete guide" },
              { href: "/eb2-niw-processing-time", label: "NIW processing time 2026" },
              { href: "/articles/eb2-niw-denial-reasons", label: "Why NIW petitions get denied" },
              { href: "/check", label: "Free NIW assessment" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="card card-interactive text-sm font-medium text-text-primary no-underline px-3 py-2 inline-block">
                  {label} →
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 card-feature flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-text-inverted">Find out if your record supports NIW or EB-1A</p>
            <p className="text-sm text-text-inverted opacity-80 mt-1">Free, honest, 5 minutes.</p>
          </div>
          <Link href="/check" className="btn btn-inverted shrink-0">Start free assessment →</Link>
        </div>

        <p className="mt-8 text-xs text-text-muted">
          Not legal advice. Consult a qualified U.S. immigration attorney before filing.
        </p>
      </article>
    </>
  );
}
