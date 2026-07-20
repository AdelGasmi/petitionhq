import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";

const TITLE = "Privacy Policy";
const DESCRIPTION =
  "How PetitionHQ collects, stores, secures, and shares your data. Encrypted storage, scoped consent, deletion on request.";
const PATH = "/privacy";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  robots: { index: true, follow: true },
};

const EFFECTIVE = "2026-02-01";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Privacy", path: PATH }])} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Privacy</span>
      </nav>

      <header className="mb-8">
        <h1 className="font-serif text-4xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-text-muted">Effective {EFFECTIVE}</p>
      </header>

      <section className="space-y-6 text-text-secondary leading-relaxed">
        <p>
          PetitionHQ (&quot;we&quot;, &quot;us&quot;) operates {BRAND.domain}. This policy describes what we collect,
          why, how we store and protect it, and the choices you have. Questions: <a className="text-text-primary hover:underline" href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">What we collect</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Eligibility data</strong>: degree, field, experience, publications, citations, awards, grants, intended U.S. endeavor — provided by you in the assessment flow.</li>
          <li><strong>Account data</strong>: name and email if you create an account.</li>
          <li><strong>Documents</strong>: CV, recommender letters, evidence exhibits, and similar materials you upload.</li>
          <li><strong>Operational telemetry</strong>: IP address, browser, page activity for security and product analytics; never sold.</li>
        </ul>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">How we use it</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>Run your eligibility assessment, generate your tier rating, draft your evidence dossier.</li>
          <li>With your explicit consent: share your structured intake packet with vetted partner immigration attorneys.</li>
          <li>Operate, secure, and improve the service.</li>
        </ul>
        <p>We do not sell your data, and we do not use your documents to train third-party AI models.</p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Security</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li>All documents are encrypted at rest in isolated object storage with token-scoped signed URLs.</li>
          <li>All traffic is HTTPS with HSTS preload.</li>
          <li>Sessions are JWT-based with server-side revocation.</li>
          <li>CSRF and rate-limit protection at the middleware layer.</li>
          <li>Regular third-party security review.</li>
        </ul>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Your choices</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Access</strong>: request a copy of your data at <a className="text-text-primary hover:underline" href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>.</li>
          <li><strong>Deletion</strong>: request permanent deletion of your account and documents. Completed within 30 days, except records we must retain under U.S. law.</li>
          <li><strong>Consent</strong>: you control which attorneys, if any, receive any document.</li>
        </ul>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Children</h2>
        <p>PetitionHQ is not directed at children under 16 and we do not knowingly collect their data.</p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-8">Changes</h2>
        <p>We will post material changes on this page and update the effective date.</p>
      </section>
    </article>
  );
}
