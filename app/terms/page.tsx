import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";

const TITLE = "Terms of Service";
const DESCRIPTION =
  "Terms governing your use of PetitionHQ — software for U.S. immigration petition preparation. Not legal advice.";
const PATH = "/terms";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  robots: { index: true, follow: true },
};

const EFFECTIVE = "2026-02-01";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Terms", path: PATH }])} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Terms</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-4xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-text-muted">Effective {EFFECTIVE}</p>
      </header>

      <section className="space-y-6 text-text-secondary leading-relaxed">
        <p>
          These terms govern your use of PetitionHQ at {BRAND.domain}. By using the service you agree to these
          terms. Questions: <a className="text-text-primary hover:underline" href={`mailto:${BRAND.founderEmail}`}>{BRAND.founderEmail}</a>.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Not legal advice</h2>
        <p>
          PetitionHQ is software for U.S. immigration petition preparation. We are not a law firm. We do not
          provide legal advice. Nothing on this site or in any output (eligibility tier, gap analysis, dossier
          draft) constitutes legal advice. Legal representation is provided exclusively by independent partner
          attorneys licensed in the United States.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Self-petitioners (beta)</h2>
        <p>
          Some accounts are invited into a free, time-boxed beta that unlocks our drafting software directly
          for self-petitioners, without a partner attorney assigned to the case. In this mode, PetitionHQ
          provides software and templates only — no attorney reviews your individual case, and using the
          software does not create an attorney-client relationship. You are solely responsible for the
          contents of anything you file with USCIS. We strongly recommend consulting a licensed immigration
          attorney before filing. Beta access is free; we do not charge self-petitioners for use of the
          software.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Accurate information</h2>
        <p>
          You agree to provide accurate, complete information in the assessment and dossier-building flows.
          USCIS adjudications rely on truthful representations; misrepresentation has serious legal consequences
          for which you alone are responsible.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">No guarantee of approval</h2>
        <p>
          USCIS approval is at USCIS's discretion. PetitionHQ does not and cannot guarantee any visa or
          petition outcome.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Acceptable use</h2>
        <p>
          You will not attempt to compromise the service's security, scrape or reverse-engineer at scale,
          impersonate another person, or use the service for any unlawful purpose.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Fees</h2>
        <p>
          The eligibility assessment, tier rating, gap analysis, and pathway recommendation are free.
          Engagement of partner attorneys is governed by each attorney's own engagement letter and is between
          you and the attorney; PetitionHQ is not a party.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Billing and refunds (attorneys)</h2>
        <p>
          Attorneys and firms using the partner network pay a platform subscription of $99 per month per seat
          (recurring) and a one-time fee of $150 for each applicant lead they choose to claim. Applicants are
          never charged by PetitionHQ.
        </p>
        <p>
          A $150 lead-claim fee is refundable in two situations: (1) if the applicant does not complete intake
          within 14 days of the claim, the fee is refunded automatically; and (2) if a claimed lead is found to
          have materially misrepresented their profile, the claiming attorney may request a refund within 30
          days of the claim date. Refund requests are reviewed by PetitionHQ; approved refunds are returned to
          the original payment method, typically within 5–10 business days. Pilot-tier claims are provided at no
          charge and are therefore non-refundable. Platform subscription fees are non-refundable except where
          required by law.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Liability</h2>
        <p>
          To the maximum extent permitted by law, PetitionHQ is provided &quot;as is&quot; without warranty of any
          kind. We are not liable for indirect, incidental, or consequential damages.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Governing law</h2>
        <p>These terms are governed by the laws of the United States and the State of Delaware.</p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Changes</h2>
        <p>We will post material changes on this page and update the effective date.</p>
      </section>
    </article>
  );
}
