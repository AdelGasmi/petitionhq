import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { faqSchema, breadcrumbSchema } from "@/components/seo/schemas";
import { canonical } from "@/lib/seo";

const TITLE = "EB-2 NIW FAQ — Pricing, Privacy & Attorney Matching";
const DESCRIPTION =
  "Common questions about PetitionHQ's free EB-2 NIW assessment: how Dhanasar scoring works, what you receive, pricing, attorney matching, and privacy.";
const PATH = "/faq";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonical(PATH), type: "article" },
};

const FAQS = [
  // ── Product
  { q: "What is PetitionHQ?", a: "PetitionHQ is a case-strength assessment platform for the EB-2 National Interest Waiver. It returns an honest tier rating, prong-level Dhanasar gap analysis, and AI-drafted evidence dossier — and optionally matches you with vetted U.S. immigration attorneys. PetitionHQ is software. It is not a law firm and does not provide legal advice." },
  { q: "Why only EB-2 NIW?", a: "We are focused exclusively on EB-2 NIW in V1 so the scoring, evidence framework, and attorney-matching layer can be best-in-class for one category before broadening. EB-1A and O-1 are on the roadmap; we will not ship them until the underlying scoring is as rigorous as it is for NIW." },
  { q: "How long does the assessment take?", a: "About five minutes for the structured questionnaire. The tier rating, prong-level narrative, and gap analysis are returned immediately." },
  { q: "Does PetitionHQ guarantee USCIS approval?", a: "No. No service can — adjudication is at USCIS's discretion. PetitionHQ provides rigorous, evidence-based assessment and high-quality dossier materials to maximize the probability of approval." },

  // ── Scoring methodology
  { q: "How is my case-strength tier calculated?", a: "Your profile is scored directly against the three Matter of Dhanasar prongs. Each prong is evaluated against the evidence patterns USCIS has historically rewarded: peer-reviewed publications, citation impact and field-normalized percentile, independent recommender letters, grants and prior funding, awards, peer-review and editorial work, patents, and the specificity of your proposed U.S. endeavor." },
  { q: "What do the tiers mean?", a: "Strong = highly likely to qualify for EB-2 NIW today. Promising = qualifies with modest evidence buildup over the next 1–3 months. Borderline = qualifies but with material risk; consider 6–12 months of additional evidence buildup before filing. Not yet ready = significant gaps; consider an O-1 bridge or PERM-sponsored pathway in the meantime." },
  { q: "How honest are the tier ratings?", a: "Honest enough that we will tell you when you are not ready. Roughly one in three applicants who complete the assessment receive a Borderline or Not yet ready tier with concrete guidance on which evidence to build. We would rather lose you to an honest result today than file you a petition that gets denied." },

  // ── Pricing
  { q: "Is the assessment really free?", a: "Yes. The assessment, tier rating, prong-level gap analysis, and pathway recommendation are free with no credit card and no account required to start." },
  { q: "What does it cost if I proceed?", a: "PetitionHQ does not charge applicants a filing fee or referral fee. If you choose to engage one of our partner attorneys, you pay that attorney directly under their standard engagement letter — typical EB-2 NIW total cost (attorney fees + USCIS filing fees + ancillary costs) is $6,000–$15,000 depending on the firm and complexity." },
  { q: "How does PetitionHQ make money?", a: "Partner attorneys pay a flat monthly subscription for network access and matched leads. Applicants are never charged a referral, contingent, or success fee." },
  { q: "What do partner attorneys pay, and is it refundable?", a: "Attorneys pay $99/month for network access plus a one-time $150 fee for each applicant lead they choose to claim — applicants never pay PetitionHQ. A $150 lead-claim fee is refunded automatically if the applicant does not complete intake within 14 days, and is refundable within 30 days if a claimed lead materially misrepresented their profile. Approved refunds return to the original payment method within 5–10 business days. Full terms are on our Terms page." },

  // ── Eligibility
  { q: "Do I need a PhD to qualify for EB-2 NIW?", a: "No. EB-2 NIW requires a U.S. master's degree (or foreign equivalent), OR a bachelor's degree plus five years of progressive post-baccalaureate experience, OR qualification under the EB-2 'exceptional ability' route (meeting at least 3 of 6 regulatory criteria). Most successful NIW petitioners hold a master's or PhD; bachelor's-plus-experience cases do succeed with strong evidence." },
  { q: "What fields does NIW favor?", a: "NIW adjudications historically reward work in U.S. priority fields: STEM research, AI/ML, biotech, climate, semiconductors, advanced manufacturing, public-health research, healthcare workforce shortages. That said, NIW has been approved across dozens of fields — the framework is field-agnostic and rewards demonstrable national-level impact." },

  // ── Attorney matching
  { q: "Do I have to use a PetitionHQ partner attorney?", a: "No. Attorney matching is optional. You can take the assessment and use the dossier with any attorney of your choosing — or proceed pro se if you are confident in your case." },
  { q: "How are partner attorneys vetted?", a: "We verify state-bar standing, confirm primary practice in U.S. immigration law with active EB-2 NIW caseload, review case-mix and field specialization, and check disciplinary history." },
  { q: "Will my data be sent to attorneys automatically?", a: "No. Nothing is shared with any attorney without your explicit, scoped consent. You see and approve each match before any documents are shared." },

  // ── Privacy / security
  { q: "How does PetitionHQ protect my data?", a: "All sensitive documents are encrypted at rest in isolated object storage with token-scoped signed URLs. All traffic is HTTPS with HSTS. Sessions are JWT-based with server-side revocation. CSRF and rate-limit protection at the middleware layer. We do not use your data to train third-party AI models." },
  { q: "Where is my data stored?", a: "Applicant data is stored in U.S. and EU regions on Cloudflare R2 (object storage) and a managed Postgres database. We do not share data with third parties without explicit consent." },
  { q: "Can I delete my data?", a: "Yes. Email privacy@petitionhq.us with your account email and we will permanently delete your account and associated documents within 30 days, retaining only what U.S. law requires (e.g., financial records of any attorney engagement)." },

  // ── Legal disclaimer
  { q: "Is PetitionHQ a law firm?", a: "No. PetitionHQ is software. We do not provide legal advice. Legal representation is provided exclusively by independent partner attorneys licensed in the United States." },
  { q: "Can I use PetitionHQ from outside the U.S.?", a: "Yes. Applicants may be located anywhere. Our partner attorneys are licensed in the United States and represent applicants in USCIS proceedings regardless of the applicant's physical location." },
];

export default function FAQPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={faqSchema(FAQS)} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "FAQ", path: PATH }])} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">FAQ</span>
      </nav>

      <header className="mb-10">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">EB-2 NIW FAQ</h1>
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          Assessment, pricing, security, and attorney matching — answered.
        </p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-primary">Take the free assessment</Link>
        </div>
      </header>

      <div className="space-y-4">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-lg border border-border-default bg-surface-card p-5">
            <summary className="cursor-pointer list-none font-serif text-lg font-semibold text-text-primary">
              <span className="flex items-center justify-between gap-4">
                {f.q}
                <span className="text-text-muted group-open:rotate-45 transition-transform" aria-hidden>+</span>
              </span>
            </summary>
            <p className="mt-3 text-text-secondary leading-relaxed">{f.a}</p>
          </details>
        ))}
      </div>

      <section className="mt-12 text-center">
        <p className="text-text-secondary">Didn&apos;t find what you were looking for?</p>
        <a href="mailto:hello@petitionhq.us" className="mt-2 inline-block font-semibold text-text-primary hover:underline">
          Email hello@petitionhq.us →
        </a>
      </section>
    </article>
  );
}
