import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";

const TITLE = "About PetitionHQ — EB-2 NIW Case-Strength Software";
const DESCRIPTION =
  "Honest EB-2 NIW case-strength assessment before you hire an attorney. Tier ratings, Dhanasar gap analysis, evidence plans. Software, not a law firm.";
const PATH = "/about";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonical(PATH), type: "article" },
};

export default function AboutPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "About", path: PATH }])} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">About</span>
      </nav>

      <header className="mb-10">
        <h1 className="font-serif text-4xl sm:text-5xl font-bold tracking-tight">About PetitionHQ</h1>
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          Rebuilding how EB-2 NIW applicants find out where their case stands — before spending five figures on an attorney.
        </p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-primary">Free NIW assessment — 5 min</Link>
        </div>
      </header>

      <section className="prose">
        <h2 className="font-serif text-2xl font-bold tracking-tight mt-2">The problem</h2>
        <p>
          The first step of every EB-2 National Interest Waiver case is the same: an applicant pays $300–$500 for a consultation with an immigration attorney to find out whether their profile is even worth filing.
          The answer usually arrives after the attorney has already pitched them on a $6,000–$15,000 engagement. The result is a market where applicants commit to filing without an honest, framework-based read on whether their case is actually ready — and attorneys spend their highest-leverage hours on intake calls that should have been a structured form.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-10">The product</h2>
        <p>
          PetitionHQ scores your profile directly against the three <em>Matter of Dhanasar</em> prongs — the controlling USCIS framework for EB-2 NIW adjudication — and returns an honest tier rating, prong-level gap analysis, and AI-drafted evidence dossier. In five minutes, for free, with no sales pitch.
          Roughly one in three applicants who complete the assessment receive a tier that says &quot;not yet ready&quot; with concrete guidance on which evidence to build before filing. We consider that the most useful answer we can give.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-10">What we are</h2>
        <p>
          PetitionHQ is software. We help applicants assess their case, build their evidence package, and reach the right attorney. We are not a law firm. We do not give legal advice. Every applicant who proceeds to filing engages a licensed U.S. immigration attorney for the legal representation portion of the case.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-10">What we value</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>Honest scoring.</strong> We tell you when you are not ready. Roughly one in three assessments end in &quot;not yet.&quot;</li>
          <li><strong>Framework-anchored.</strong> Built directly on Matter of Dhanasar and the evidence patterns USCIS has historically rewarded. No marketing heuristics.</li>
          <li><strong>Citation-traceable AI.</strong> Every line of every AI-drafted output traces back to your real credentials. No invented publications. No inflated claims.</li>
          <li><strong>Consent-first data handling.</strong> Encrypted storage. Revocable sessions. Nothing shared with any attorney without your explicit, scoped approval.</li>
        </ul>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-10">Roadmap</h2>
        <p>
          V1 is EB-2 NIW only. EB-1A and O-1 are on the roadmap; we will not ship them until the underlying scoring engine is as rigorous as it is for NIW. Other employment-based and family-based categories are out of scope.
        </p>

        <h2 className="font-serif text-2xl font-bold tracking-tight mt-10">Contact</h2>
        <ul className="space-y-1">
          <li>General: <a className="text-text-primary hover:underline" href={`mailto:${BRAND.founderEmail}`}>{BRAND.founderEmail}</a></li>
          <li>Support: <a className="text-text-primary hover:underline" href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a></li>
          <li>Privacy: <a className="text-text-primary hover:underline" href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a></li>
        </ul>
      </section>

      <section className="mt-12 rounded-2xl bg-surface-inverted px-6 py-10 text-text-inverted text-center sm:px-12">
        <h2 className="font-serif text-2xl font-bold tracking-tight">See where your EB-2 NIW case actually stands.</h2>
        <p className="mt-2 text-text-disabled">Free, 5-minute assessment. Honest tier — including &quot;not yet.&quot;</p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-inverted">
            Start free check →
          </Link>
        </div>
      </section>
    </article>
  );
}
