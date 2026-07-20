import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  articleSchema,
  breadcrumbSchema,
  faqSchema,
} from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";

const TITLE = "EB-2 NIW Guide: Eligibility, Dhanasar Prongs & Evidence";
const DESCRIPTION =
  "Complete 2026 EB-2 NIW guide: who qualifies, the three Dhanasar prongs, evidence that wins, common pitfalls, and how to file. By PetitionHQ.";
const PATH = "/eb2-niw-guide";
const PUBLISHED = "2026-02-01";
// Real last-modified date — bump when the guide content materially changes.
// Never use new Date(): it fakes daily freshness and erodes crawler trust.
const MODIFIED = "2026-06-09";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "EB-2 NIW",
    "EB-2 National Interest Waiver",
    "EB-2 NIW eligibility",
    "Matter of Dhanasar",
    "Dhanasar prongs",
    "NIW evidence",
    "NIW petition guide",
    "EB-2 vs EB-1A",
    "NIW for researchers",
    "self-petition green card",
  ],
  alternates: { canonical: canonical(PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: canonical(PATH),
    type: "article",
    publishedTime: PUBLISHED,
    modifiedTime: MODIFIED,
  },
};

const FAQS = [
  {
    q: "What is the EB-2 NIW?",
    a: "The EB-2 National Interest Waiver is an immigrant-visa subcategory that allows advanced-degree professionals or individuals with exceptional ability to self-petition for a U.S. green card without an employer-sponsored PERM labor certification. USCIS adjudicates NIW petitions under the three Matter of Dhanasar prongs.",
  },
  {
    q: "What are the three Matter of Dhanasar prongs?",
    a: "Prong 1 — the proposed endeavor has substantial merit and national importance. Prong 2 — the applicant is well positioned to advance the proposed endeavor. Prong 3 — on balance, it would benefit the United States to waive the job-offer and PERM requirements.",
  },
  {
    q: "Do I need a PhD to qualify for EB-2 NIW?",
    a: "No. A U.S. master's degree (or foreign equivalent) is sufficient to meet the EB-2 advanced-degree requirement. Bachelor's-degree holders with at least five years of progressive post-baccalaureate experience also qualify under EB-2. Individuals without a qualifying degree may still qualify under the EB-2 'exceptional ability' route by meeting at least three of six regulatory criteria.",
  },
  {
    q: "Can I file EB-2 NIW from inside the U.S.?",
    a: "Yes. NIW applicants can either file Form I-140 standalone while abroad and consular-process, or — if a visa number is available — file I-140 concurrently with Form I-485 (Adjustment of Status) from inside the U.S.",
  },
  {
    q: "How long does the EB-2 NIW process take?",
    a: "I-140 adjudication ranges from a few months (with premium processing, currently 45 business days for NIW) to a year or more under standard processing. After I-140 approval, the timeline depends on visa-bulletin priority dates by country of birth — current applicants from India and China face significant backlogs; most other countries do not.",
  },
  {
    q: "What evidence makes an EB-2 NIW case strong?",
    a: "Peer-reviewed publications, citation counts, awards or grants, prior funding, peer-review/editorial work, patents, original contributions of significance, evidence of national-level impact, independent recommender letters from credible experts, and a clearly-articulated U.S. endeavor with documented demand. The strongest petitions tie evidence directly to each Dhanasar prong with citations to USCIS adjudications and credible third-party sources.",
  },
  {
    q: "EB-2 NIW vs EB-1A — which should I file?",
    a: "EB-1A has a higher evidentiary bar (extraordinary ability — top of the field) but no country backlog for most applicants and immediate priority dates. EB-2 NIW has a lower bar (well-positioned, nationally important work) but is subject to the EB-2 visa-bulletin queue. Many strong candidates file both concurrently to hedge timeline and approval risk.",
  },
  {
    q: "Can I file EB-2 NIW without an attorney?",
    a: "It is legally permitted, but not advisable. NIW adjudication is highly discretionary and evidence-driven; a single weak prong analysis or weak recommender letter can sink an otherwise strong profile. PetitionHQ's free eligibility check gives you an honest read on your case before you commit to representation.",
  },
];

export default function EB2NIWGuide() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={articleSchema({ title: TITLE, description: DESCRIPTION, path: PATH, datePublished: PUBLISHED, dateModified: MODIFIED })} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "EB-2 NIW Guide", path: PATH }])} />
      <JsonLd data={faqSchema(FAQS)} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">EB-2 NIW Guide</span>
      </nav>

      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Visa guide · Updated {MODIFIED}</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl font-bold tracking-tight text-text-primary">
          EB-2 NIW guide: eligibility, Dhanasar prongs &amp; evidence (2026)
        </h1>
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          Who qualifies, the three Matter of Dhanasar prongs, the evidence that moves a case from borderline to strong, and how to file.
        </p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-primary">Check your NIW eligibility — free, 5 min</Link>
        </div>
      </header>

      <nav aria-label="Table of contents" className="mb-10 rounded-lg border border-border-default bg-surface-card p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">On this page</p>
        <ol className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
          <li><a href="#what-is-niw" className="text-text-secondary hover:text-text-primary hover:underline">1. What is the EB-2 NIW?</a></li>
          <li><a href="#eligibility" className="text-text-secondary hover:text-text-primary hover:underline">2. EB-2 baseline eligibility</a></li>
          <li><a href="#dhanasar" className="text-text-secondary hover:text-text-primary hover:underline">3. The three Dhanasar prongs</a></li>
          <li><a href="#evidence" className="text-text-secondary hover:text-text-primary hover:underline">4. Evidence that wins NIW cases</a></li>
          <li><a href="#vs-eb1a" className="text-text-secondary hover:text-text-primary hover:underline">5. EB-2 NIW vs EB-1A vs O-1</a></li>
          <li><a href="#process" className="text-text-secondary hover:text-text-primary hover:underline">6. Filing process & timeline</a></li>
          <li><a href="#pitfalls" className="text-text-secondary hover:text-text-primary hover:underline">7. Common pitfalls</a></li>
          <li><a href="#faq" className="text-text-secondary hover:text-text-primary hover:underline">8. FAQ</a></li>
        </ol>
      </nav>

      <section id="what-is-niw" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">1. What is the EB-2 NIW?</h2>
        <p>
          The EB-2 National Interest Waiver is a subcategory of the second-preference employment-based immigrant visa.
          Created by Congress in the Immigration Act of 1990 and adjudicated today under the framework set by{" "}
          <strong>Matter of Dhanasar, 26 I&amp;N Dec. 884 (AAO 2016)</strong>, the NIW lets qualifying individuals
          <strong> self-petition for a U.S. green card without an employer sponsor and without going through the
          PERM labor-certification process</strong>.
        </p>
        <p>
          In practice that means an EB-2 NIW applicant is in control of their own immigration timeline. There is no
          employer dependency, no PERM-recruitment delay (typically 12–18 months), and no risk of losing the petition
          if a job changes. The trade-off: the applicant must convince USCIS that their proposed U.S. endeavor — and
          their ability to advance it — is important enough to justify waiving the job-offer requirement that EB-2
          normally requires.
        </p>
      </section>

      <section id="eligibility" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">2. EB-2 baseline eligibility</h2>
        <p>Before NIW-specific factors apply, the petitioner must qualify under EB-2 itself. There are two routes:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Advanced degree</strong> — A U.S. master's degree (or foreign equivalent) in the field, or a U.S. bachelor's degree (or foreign equivalent) plus at least five years of progressive post-baccalaureate experience.</li>
          <li><strong>Exceptional ability</strong> — Meeting at least three of six regulatory criteria (degree, 10+ years of experience, professional license, high salary, membership in professional associations, recognition by peers/government).</li>
        </ul>
        <p>Most successful NIW petitioners qualify on the advanced-degree route. Exceptional-ability NIW cases are filed but require deliberate evidentiary buildup.</p>
      </section>

      <section id="dhanasar" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">3. The three Matter of Dhanasar prongs</h2>
        <p>USCIS evaluates NIW petitions against a three-prong test set out in Matter of Dhanasar. All three must be met.</p>

        <h3 className="font-serif text-xl font-bold mt-6 mb-2">Prong 1 — Substantial merit and national importance</h3>
        <p>
          The proposed endeavor must have substantial intrinsic merit and national-level importance.
          <strong> Merit</strong> can be demonstrated in any field — sciences, technology, business, healthcare, education, arts, athletics —
          and does not require an immediate quantifiable economic impact. <strong>National importance</strong> looks at
          potential prospective impact, not the geographic scope of employment: USCIS expressly recognizes endeavors with broad
          implications even when carried out in a single locality.
        </p>
        <p>
          Strong Prong 1 narratives anchor the endeavor to a documented U.S. priority — federal R&amp;D agency strategy papers,
          National Academies reports, USCIS policy guidance, executive-branch priorities, state-level economic-development plans,
          industry-shortage reports. Generic "this field matters" assertions fail.
        </p>

        <h3 className="font-serif text-xl font-bold mt-6 mb-2">Prong 2 — Well positioned to advance the endeavor</h3>
        <p>
          USCIS looks at the petitioner's specific skills, knowledge, record of success, prior progress on the endeavor,
          and any plan or model for advancing it. Evidence includes degrees, publications, citation record, prior funding,
          patents, awards, peer-review activity, leadership roles, recommender letters from independent experts, and
          end-user adoption or interest.
        </p>
        <p>
          The strongest Prong 2 cases show <em>track record + forward momentum</em>: past achievements that closely match
          the proposed endeavor, plus concrete evidence that future progress is plausible (existing collaborators,
          letters of interest, ongoing funded work, signed offers).
        </p>

        <h3 className="font-serif text-xl font-bold mt-6 mb-2">Prong 3 — On balance, beneficial to the U.S. to waive PERM</h3>
        <p>
          USCIS weighs the benefit of bringing the petitioner in via NIW against the policy purpose of PERM (protecting U.S.
          workers). Factors include: impracticality of a PERM job description for the endeavor, urgency, the petitioner's
          unique combination of skills, and whether the endeavor would proceed even without the petitioner.
        </p>
        <p>
          Self-employed founders, independent researchers, and entrepreneurs typically argue Prong 3 on impracticality grounds
          (no employer to sponsor). Employed researchers and engineers typically argue on urgency, unique-skill, or
          beneficial-to-the-public grounds.
        </p>
      </section>

      <section id="evidence" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">4. Evidence that wins NIW cases</h2>
        <p>NIW adjudication is heavily evidence-driven. The categories that move the needle, in roughly descending order of impact for typical research-track applicants:</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li><strong>Peer-reviewed publications and citation record.</strong> Total citations, h-index, and field-normalized percentile rankings are the most consistently weighted indicators of impact.</li>
          <li><strong>Independent expert recommender letters.</strong> Five to eight letters from credible, independent experts who can speak to specific contributions. "Independent" means: not co-authors, not direct collaborators, not advisors. This is the single most-undervalued evidence category.</li>
          <li><strong>Prior funding and grants.</strong> Federal grants (NSF, NIH, DOE, DARPA), competitive private funding (VC seed/Series A for founders), and large institutional grants demonstrate independent expert validation.</li>
          <li><strong>Awards, prizes, and competitive selections.</strong> Particularly those with national or international scope.</li>
          <li><strong>Peer-review and editorial work.</strong> Manuscript review for established journals, program committee membership, editorial board roles.</li>
          <li><strong>Original contributions of significance.</strong> Patents (granted, not just applied), open-source impact, deployed products, datasets used by other researchers.</li>
          <li><strong>Documentary evidence of national priority.</strong> Government reports, agency strategy documents, USCIS policy memos linking the field to national interest.</li>
          <li><strong>Concrete plan for the proposed endeavor.</strong> Employer letters, signed offers, letters of intent, business plans with revenue or impact projections.</li>
        </ol>
        <p className="mt-3 text-sm">
          Deep dives: <Link href="/articles/niw-citations-how-many" className="text-text-link hover:underline">How many citations do you need?</Link> · <Link href="/articles/niw-recommendation-letters" className="text-text-link hover:underline">NIW recommendation letters — structure and independence rules</Link>
        </p>
      </section>

      <section id="vs-eb1a" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">5. EB-2 NIW vs EB-1A vs O-1 — picking the right path</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default bg-surface-subtle">
                <th className="text-left p-3">Factor</th>
                <th className="text-left p-3">EB-2 NIW</th>
                <th className="text-left p-3">EB-1A</th>
                <th className="text-left p-3">O-1A</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              <tr><td className="p-3 font-medium">Type</td><td className="p-3">Immigrant (green card)</td><td className="p-3">Immigrant (green card)</td><td className="p-3">Nonimmigrant (3-year visa)</td></tr>
              <tr><td className="p-3 font-medium">Employer sponsor</td><td className="p-3">Not required</td><td className="p-3">Not required</td><td className="p-3">Required (or agent)</td></tr>
              <tr><td className="p-3 font-medium">Evidentiary bar</td><td className="p-3">Moderate — well positioned</td><td className="p-3">High — top of field</td><td className="p-3">Moderate–high</td></tr>
              <tr><td className="p-3 font-medium">Country backlog</td><td className="p-3">Yes (India/China)</td><td className="p-3">Minimal for most</td><td className="p-3">N/A (no quota)</td></tr>
              <tr><td className="p-3 font-medium">Premium processing</td><td className="p-3">Available (45 days)</td><td className="p-3">Available (15 days)</td><td className="p-3">Available (15 days)</td></tr>
              <tr><td className="p-3 font-medium">Path to permanent</td><td className="p-3">Direct</td><td className="p-3">Direct</td><td className="p-3">Indirect — bridge to EB-1A/EB-2</td></tr>
            </tbody>
          </table>
        </div>
        <p className="mt-4">
          Many strong candidates file <strong>EB-2 NIW concurrently with EB-1A</strong>: NIW provides a fallback if EB-1A
          is denied, and EB-1A skips the EB-2 queue when approved. PetitionHQ today scores only the EB-2 NIW case strength;
          EB-1A scoring is on the roadmap. If your free NIW assessment returns a Strong tier, an EB-1A parallel filing is
          worth discussing with your attorney.
        </p>
        <p className="mt-3">
          See the full side-by-side breakdown: <Link href="/eb2-niw-vs-eb1a" className="text-text-link hover:underline">EB-2 NIW vs EB-1A — The Complete Comparison</Link>.
        </p>
      </section>

      <section id="process" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">6. Filing process and timeline</h2>
        <ol className="list-decimal pl-6 space-y-2">
          <li><strong>Eligibility assessment</strong> (free at PetitionHQ): 5 minutes; produces a tier rating + gap analysis.</li>
          <li><strong>Evidence collection</strong>: typically 4–10 weeks depending on recommender-letter turnaround.</li>
          <li><strong>Petition drafting (I-140 + supporting brief)</strong>: 2–4 weeks once evidence is in.</li>
          <li><strong>USCIS adjudication</strong>: 45 business days with premium processing; 6–12+ months under standard processing.</li>
          <li><strong>Adjustment of Status (I-485) or Consular Processing</strong>: subject to priority-date availability per the Visa Bulletin.</li>
        </ol>
        <p className="mt-3">
          For detailed timelines, premium vs standard processing, and Visa Bulletin backlog by country, see the <Link href="/eb2-niw-processing-time" className="text-text-link hover:underline">EB-2 NIW processing time guide</Link>.
        </p>
      </section>

      <section id="pitfalls" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">7. Common pitfalls</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Generic Prong 1 narrative.</strong> "AI is important" is not Prong 1. Cite specific federal strategy documents or NAS reports.</li>
          <li><strong>Recommender letters from co-authors only.</strong> USCIS heavily discounts non-independent letters. Aim for 60%+ independent recommenders.</li>
          <li><strong>Citation counts presented without context.</strong> Always include field-normalized percentile or comparator data.</li>
          <li><strong>Mismatch between past work and proposed endeavor.</strong> If your publications are in topic A but your endeavor is in topic B, Prong 2 collapses. Either re-frame the endeavor or build a credible bridge narrative.</li>
          <li><strong>Filing too early.</strong> Borderline cases rarely improve under RFE response — they're better delayed 6–12 months for evidence buildup.</li>
        </ul>
        <p className="mt-3 text-sm">
          Related: <Link href="/articles/eb2-niw-rfe-response" className="text-text-link hover:underline">EB-2 NIW RFE — what it means and how to respond</Link> · <Link href="/articles/eb2-niw-denial-reasons" className="text-text-link hover:underline">Why NIW petitions get denied</Link>
        </p>
      </section>

      <section id="faq" className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-12 mb-4">8. EB-2 NIW frequently asked questions</h2>
        <div className="space-y-4 mt-4">
          {FAQS.map((f) => (
            <details key={f.q} className="group rounded-lg border border-border-default bg-surface-card p-5">
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
      </section>

      <section className="mt-16 rounded-2xl bg-surface-inverted px-6 py-12 text-text-inverted text-center sm:px-12">
        <h2 className="font-serif text-3xl font-bold tracking-tight">See where your EB-2 NIW case stands.</h2>
        <p className="mt-3 text-text-disabled">Free, USCIS-aligned assessment. No payment required. Five minutes.</p>
        <div className="mt-6">
          <Link href="/check" className="btn btn-inverted btn-lg">
            Start my free EB-2 NIW check →
          </Link>
        </div>
      </section>

      <p className="mt-12 text-xs text-text-muted text-center">
        Published {PUBLISHED} · Last updated {MODIFIED} · By {BRAND.name} · This guide is general information, not legal advice.
      </p>
    </article>
  );
}
