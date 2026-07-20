import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema, faqSchema, howToSchema } from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";

const PATH = "/eb2-niw-processing-time";
const TITLE = "EB-2 NIW Processing Time 2026: Premium vs Standard";
const DESCRIPTION =
  "EB-2 NIW I-140 processing time 2026: 45 business days premium, 6–18 months standard. Visa Bulletin backlog by country, RFE timeline, and I-485 wait.";

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
    q: "How long does EB-2 NIW premium processing take in 2026?",
    a: "USCIS guarantees a substantive action (approval, RFE, denial, or notice of intent to deny) within 45 business days for I-140 petitions filed with premium processing. 45 business days is approximately 9 calendar weeks. An RFE response extends the premium processing clock — USCIS has an additional 45 business days from RFE response receipt to take action.",
  },
  {
    q: "What is the standard EB-2 NIW processing time?",
    a: "Standard I-140 processing for EB-2 NIW cases at the Nebraska and Texas Service Centers typically runs 6–18 months as of mid-2026, with some offices showing longer queues. USCIS updates its published processing times weekly — check the USCIS processing times tool at uscis.gov/processing-times with form I-140 and your filing office.",
  },
  {
    q: "After I-140 approval, how long until I get my green card?",
    a: "For most countries (not India or China): I-485 Adjustment of Status can often be filed concurrently with I-140 or immediately after approval, since priority dates are current. Total I-485 processing in 2026 runs 12–36 months depending on field office and biometrics scheduling. For India-born petitioners, the EB-2 visa backlog extends waiting to an estimated 10+ years from I-140 approval as of 2026.",
  },
  {
    q: "Does premium processing guarantee approval?",
    a: "No. Premium processing guarantees a processing timeline, not an outcome. An RFE (Request for Evidence) or NOID (Notice of Intent to Deny) is a valid 'substantive action' and stops the clock. You then have additional time to respond. If you receive an RFE under premium processing and respond, the premium processing SLA resets — USCIS has another 45 business days from receiving your response.",
  },
  {
    q: "Can I upgrade to premium processing after filing?",
    a: "Yes. You can upgrade a pending I-140 to premium processing at any time by filing Form I-907 and paying the premium processing fee (currently $2,805 as of 2026). The premium processing clock starts from USCIS's receipt of the I-907, not the original I-140 filing date.",
  },
];

export default function Eb2NiwProcessingTimePage() {
  return (
    <>
      <JsonLd data={howToSchema({
        name: "How to file an EB-2 NIW I-140 petition",
        description: "Step-by-step process from eligibility assessment to USCIS adjudication for an EB-2 National Interest Waiver I-140 petition.",
        steps: [
          { name: "Run a free eligibility assessment", text: "Use PetitionHQ or consult an immigration attorney to evaluate your profile against the three Dhanasar prongs. Get a tier rating and gap analysis before investing in evidence collection." },
          { name: "Collect your evidence package", text: "Gather publications, citation data, grant awards, recommendation letters from independent experts, and national-priority documentation. Typical turnaround: 4–10 weeks." },
          { name: "Draft the I-140 petition and supporting brief", text: "Prepare the I-140 form, a proposed-endeavor brief addressing all three Dhanasar prongs, and an exhibit list. Drafting typically takes 2–4 weeks with all evidence in hand." },
          { name: "File with USCIS and choose processing speed", text: "File at the appropriate Service Center. Include Form I-907 and the premium processing fee ($2,805) to lock in a 45-business-day adjudication SLA." },
          { name: "Respond to any RFE", text: "If USCIS issues a Request for Evidence, respond within the stated deadline (typically 87 days). Under premium processing, the SLA resets for 45 business days from USCIS receipt of your response." },
          { name: "File I-485 or begin consular processing", text: "After I-140 approval, file Form I-485 (if in the U.S. and priority date is current) or proceed to consular processing. For most countries, priority dates are current; for India/China, check the monthly Visa Bulletin." },
        ],
      })} />
      <JsonLd data={breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "EB-2 NIW Guide", path: "/eb2-niw-guide" },
        { name: "Processing Time 2026", path: PATH },
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
            <li className="text-text-secondary">Processing Time 2026</li>
          </ol>
        </nav>

        {/* Header */}
        <header className="mb-10">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text-primary mb-4">
            EB-2 NIW Processing Time 2026: Premium vs Standard
          </h1>
          <p className="text-lg text-text-secondary leading-relaxed">
            The I-140 is just one clock. Here is the full timeline from eligibility assessment through
            green card in hand — with premium vs standard processing, RFE scenarios, and Visa Bulletin
            backlog by country.
          </p>
          <p className="mt-3 text-xs text-text-muted">
            By PetitionHQ · Updated June 2026 · 8 min read
          </p>
        </header>

        <div className="prose">
          <h2>The fast answer</h2>
          <ul>
            <li><strong>Premium I-140:</strong> 45 business days (~9 calendar weeks) for a substantive action from USCIS.</li>
            <li><strong>Standard I-140:</strong> 6–18 months depending on Service Center queue.</li>
            <li><strong>After I-140 approval (most countries):</strong> I-485 Adjustment of Status concurrently or immediately; green card 12–36 months after I-485 filing.</li>
            <li><strong>After I-140 approval (India):</strong> EB-2 backlog estimated at 10+ years as of 2026 before a visa number becomes available.</li>
          </ul>

          <h2>End-to-end timeline table</h2>
        </div>

        {/* Timeline table */}
        <div className="my-8 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="table-header-cell text-left">Stage</th>
                <th className="table-header-cell text-left">Typical duration</th>
                <th className="table-header-cell text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {[
                ["Eligibility assessment", "1 day–1 week", "Free 5-minute tool at PetitionHQ; attorney review adds 1–2 weeks"],
                ["Evidence collection", "4–10 weeks", "Bottleneck is usually recommender letter turnaround (6–8 weeks typical)"],
                ["Petition drafting", "2–4 weeks", "I-140 form + proposed-endeavor brief + exhibit preparation"],
                ["USCIS receipt + biometrics", "1–2 weeks", "USCIS mails receipt notice; premium processing clock starts from receipt"],
                ["I-140 adjudication (premium)", "45 business days (~9 weeks)", "Substantive action guarantee; RFE response resets clock for another 45 days"],
                ["I-140 adjudication (standard)", "6–18 months", "Service Center dependent; check USCIS processing times tool weekly"],
                ["RFE response window (if issued)", "87 days (12 weeks) max", "Premium processing clock pauses; USCIS gives new 45-day window after response"],
                ["I-485 filing (concurrent or after I-140)", "Immediately if priority current", "Most countries: concurrent filing possible; India/China: wait for Visa Bulletin"],
                ["I-485 adjudication", "12–36 months", "Field office dependent; biometrics appointment adds 2–4 months"],
                ["Green card delivered", "2–4 weeks after approval", "USCIS mails the physical card after I-485 approval"],
              ].map(([stage, duration, notes]) => (
                <tr key={stage as string} className="border-b border-border-subtle">
                  <td className="py-3 pr-4 font-medium text-text-primary align-top">{stage}</td>
                  <td className="py-3 pr-4 align-top whitespace-nowrap">{duration}</td>
                  <td className="py-3 align-top text-xs">{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="prose">
          <h2>Premium processing: what the 45 days actually means</h2>
          <p>
            Premium processing (Form I-907, currently $2,805) is a procedural SLA — USCIS guarantees to
            take a "substantive action" within 45 business days. A substantive action can be:
          </p>
          <ul>
            <li>Approval</li>
            <li>Denial</li>
            <li>RFE (Request for Evidence)</li>
            <li>NOID (Notice of Intent to Deny)</li>
          </ul>
          <p>
            Receiving an RFE is not a failure of premium processing. You then have up to 87 days to
            respond. After USCIS receives your response, the premium processing SLA resets: USCIS has
            another 45 business days to act. Total premium timeline with an RFE: ~30 weeks worst case.
          </p>
          <p>
            You can upgrade from standard to premium processing at any time by filing I-907 separately.
            The 45-day clock starts from USCIS receipt of the I-907, not the original I-140 filing date.
          </p>

          <h2>Is premium processing worth it for EB-2 NIW?</h2>
          <p>
            The calculus is straightforward. If you are in H-1B or another status with an expiration
            within 12–18 months, premium processing significantly reduces the risk of a lapse. If you
            are not time-constrained, standard processing saves $2,805 and only costs wait time.
          </p>
          <p>
            Note that premium processing for I-140 <strong>does not</strong> accelerate I-485 or the
            visa queue — it only accelerates the I-140 adjudication itself. For India-born applicants
            facing a multi-decade backlog, premium I-140 is mostly irrelevant to the actual green card
            timeline.
          </p>

          <h2>Visa Bulletin backlog by country</h2>
          <p>
            EB-2 is a second-preference immigrant category subject to per-country numerical limits.
            USCIS publishes the Visa Bulletin monthly. As of June 2026:
          </p>
        </div>

        {/* Backlog table */}
        <div className="my-8 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border-default">
                <th className="table-header-cell text-left">Country of birth</th>
                <th className="table-header-cell text-left">EB-2 cutoff date (approx.)</th>
                <th className="table-header-cell text-left">Estimated backlog</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {[
                ["Most countries (ROW)", "Current — no backlog", "0 — visa numbers available immediately"],
                ["China (mainland-born)", "~2019–2020 (estimated)", "5–7 years from I-140 approval"],
                ["India", "~2012–2013 (estimated)", "10–15+ years from I-140 approval"],
                ["Philippines", "Current or near-current", "Minimal — check current bulletin"],
                ["Mexico", "Current", "No backlog"],
                ["El Salvador / Guatemala / Honduras", "Current", "No backlog"],
              ].map(([country, cutoff, backlog]) => (
                <tr key={country as string} className="border-b border-border-subtle">
                  <td className="py-3 pr-4 font-medium text-text-primary align-top">{country}</td>
                  <td className="py-3 pr-4 align-top">{cutoff}</td>
                  <td className="py-3 align-top text-xs">{backlog}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mb-8">
          Cutoff dates are approximate as of June 2026 and change monthly. Always verify at
          travel.state.gov/visa-bulletin before planning.
        </p>

        <div className="prose">
          <h2>India backlog: EB-1A as a workaround</h2>
          <p>
            For India-born applicants, EB-1 (first preference, which includes EB-1A extraordinary
            ability) has a meaningfully shorter backlog than EB-2 — though both are severe. This is
            why many strong India-born petitioners file EB-2 NIW and EB-1A concurrently: if EB-1A is
            approved, the EB-1 queue is ahead of the EB-2 queue by several years.
          </p>
          <p>
            See the full comparison in <Link href="/eb2-niw-vs-eb1a" className="text-text-link hover:underline">EB-2 NIW vs EB-1A</Link>.
          </p>

          <h2>How to check your case status</h2>
          <ol>
            <li>Go to <strong>my.uscis.gov</strong> and log in or create a myUSCIS account.</li>
            <li>Enter your receipt number (format: EAC-XX-XXX-XXXXX for Nebraska, SRC-XX-XXX-XXXXX for Texas).</li>
            <li>For published Service Center averages (not your individual case), use the USCIS Processing Times tool at uscis.gov/processing-times — enter Form I-140 and your Service Center.</li>
            <li>If your case is outside the published processing time, you can submit a case inquiry at the same URL.</li>
          </ol>
        </div>

        {/* Mid-article CTA */}
        <div className="my-10 rounded-xl bg-surface-subtle border border-border-default px-6 py-5">
          <p className="text-sm font-semibold text-text-primary mb-2">Know where you stand before you file</p>
          <p className="text-sm text-text-secondary mb-4">
            Our free assessment tells you your EB-2 NIW tier, gap analysis, and whether your record is
            ready to file now or needs 6–12 months of evidence-building first.
          </p>
          <Link href="/check" className="btn btn-primary text-sm">Check my readiness — free</Link>
        </div>

        {/* FAQ */}
        <div className="prose">
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
              { href: "/eb2-niw-vs-eb1a", label: "EB-2 NIW vs EB-1A comparison" },
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
            <p className="font-semibold text-text-inverted">Ready to start your NIW petition?</p>
            <p className="text-sm text-text-inverted opacity-80 mt-1">Free assessment in 5 minutes. Honest result.</p>
          </div>
          <Link href="/check" className="btn btn-inverted shrink-0">Start free assessment →</Link>
        </div>

        <p className="mt-8 text-xs text-text-muted">
          Processing times are estimates based on published USCIS data as of June 2026 and change frequently.
          Verify current times at uscis.gov/processing-times. Not legal advice.
        </p>
      </article>
    </>
  );
}
