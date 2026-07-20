import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/components/seo/schemas";
import { canonical } from "@/lib/seo";

const TITLE = "Verification Methodology — PetitionHQ Confirms Credentials";
const DESCRIPTION =
  "How PetitionHQ resolves researchers across 7+ public databases and scores credential claims. What we verify, what we don't, and our auto-refund policy.";
const PATH = "/verification";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical(PATH) },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: canonical(PATH),
    type: "article",
  },
};

const SOURCES = [
  {
    name: "OpenAlex",
    url: "https://openalex.org",
    verifies: "Publications, citations, co-authors, research topics, affiliation",
    corroborates: "The primary identity anchor for most researchers — and the body-of-work signal",
  },
  {
    name: "ORCID",
    url: "https://orcid.org",
    verifies: "A self-claimed researcher ID, publication list, affiliation",
    corroborates: "The strongest deterministic identity anchor, when the applicant has one",
  },
  {
    name: "Crossref",
    url: "https://www.crossref.org",
    verifies: "DOI-level authorship and publication metadata",
    corroborates: "Independent confirmation of authorship on indexed works",
  },
  {
    name: "ROR",
    url: "https://ror.org",
    verifies: "That an institution is a real, registered organization, its type and country",
    corroborates: "The institution component — the named affiliation actually exists",
  },
  {
    name: "NSF Award Search",
    url: "https://www.nsf.gov/awardsearch/",
    verifies: "NSF grant awards by PI name",
    corroborates: "Federal funding under the resolved identity",
  },
  {
    name: "NIH RePORTER",
    url: "https://reporter.nih.gov",
    verifies: "NIH grant awards by PI name",
    corroborates: "Federal funding under the resolved identity",
  },
  {
    name: "USPTO PatentsView",
    url: "https://patentsview.org",
    verifies: "Granted patents by inventor name",
    corroborates: "Inventorship under the resolved identity",
  },
];

const NOT_VERIFIED = [
  "Invited talks and conference presentations (no comprehensive public database exists)",
  "Awards and honors (issuing bodies rarely maintain searchable databases)",
  "Peer review and editorial board roles (reviewer data is confidential by design)",
  "Specific degree dates or transcripts (not available via public APIs)",
  "Media coverage or press mentions",
  "Letters of recommendation content or authorship",
];

// Trust-model v2 (2026): an identity-anchored evidence floor, not additive
// bonuses. Components and ranges mirror lib/verification/scoring.ts exactly.
const COMPONENTS = [
  {
    component: "Identity corroboration",
    range: "0 / 35 / 45 / 55",
    description:
      "The floor. Set by how many independent sources agree on one resolved person: none → 0, one source → 35, two → 45, three or more → 55. This is the heart of the score.",
  },
  {
    component: "Publication substance",
    range: "0 to +15",
    description:
      "A real, indexed body of work — number of works, aggregated citations, and h-index, counted only over sources that agree on the same person.",
  },
  {
    component: "Claim consistency",
    range: "−15 to +20",
    description:
      "Self-reported numbers checked against the public record. Honest, modest claims earn points. The only way to lose points is an egregious overclaim against a confidently-resolved record (e.g. claiming 5,000 citations against a record showing ~500).",
  },
  {
    component: "Institution & funding",
    range: "0 to +10",
    description:
      "The named institution is registered in ROR, and/or grants are corroborated under the resolved identity.",
  },
  {
    component: "No corroborating source (ghost)",
    range: "0",
    description:
      "If not a single public source corroborates the identity, the score is 0 — full stop. We never invent trust from a name alone.",
  },
];

export default function VerificationMethodologyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-12 px-4 py-12">
      <JsonLd data={breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Verification Methodology", path: PATH },
      ])} />
      {/* Header */}
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
          Methodology
        </p>
        <h1 className="font-serif text-3xl tracking-tight text-text-primary sm:text-4xl">
          Verification Methodology
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed">
          PetitionHQ does two things, in order: first it resolves <em>one</em>{" "}
          real researcher across 7+ public databases — dropping namesakes — then
          it scores how well that person&apos;s self-reported claims hold up
          against the public record. Trust is about authenticity, not prestige.
        </p>
      </div>

      {/* What we verify */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight text-text-primary">
          What We Verify
        </h2>
        <p className="text-sm text-text-secondary">
          Each report queries 7+ independent sources. A source only counts when
          it <strong>agrees</strong> with the resolved identity — a database
          that returns a different person who happens to share the applicant&apos;s
          name is dropped as a namesake, never counted and never held against
          them.
        </p>
        <div className="overflow-hidden rounded-xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  What It Confirms
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  What It Corroborates
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {SOURCES.map((s) => (
                <tr key={s.name}>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline decoration-border-default hover:text-text-link"
                    >
                      {s.name}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{s.verifies}</td>
                  <td className="px-4 py-3 text-text-muted">
                    {s.corroborates}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* What we don't verify */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight text-text-primary">
          What We Don&apos;t Verify
        </h2>
        <p className="text-sm text-text-secondary">
          Some credentials lack comprehensive public databases. These items are
          marked &ldquo;Self-Reported&rdquo; in the verification report —
          meaning they come from the applicant&apos;s intake form and have not
          been independently confirmed.
        </p>
        <ul className="space-y-2">
          {NOT_VERIFIED.map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-text-muted" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      {/* How trust score is computed */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight text-text-primary">
          How the Trust Score Is Computed
        </h2>
        <p className="text-sm text-text-secondary">
          The trust score is a deterministic number from 0 to 100 — no machine
          learning, no subjective judgment. It is built as an{" "}
          <strong>evidence floor</strong>, not a pile of additive bonuses: the
          floor is set by how many independent sources agree it&apos;s the same
          person, and a few components adjust it from there. The whole thing
          runs <em>after</em> we&apos;ve resolved who the applicant is.
        </p>
        <div className="overflow-hidden rounded-xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Component
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Range
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                  What it measures
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {COMPONENTS.map((c) => (
                <tr key={c.component}>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {c.component}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm text-text-secondary whitespace-nowrap">
                    {c.range}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {c.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted">
          The components sum and the result is clamped to 0–100. A researcher
          corroborated by three agreeing sources starts at a 55 floor, then adds
          publication substance, claim consistency, and institution corroboration
          on top — while someone no public source can place stays at 0.
        </p>
      </section>

      {/* Existence vs. Ownership */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight text-text-primary">
          What &ldquo;Publicly Corroborated&rdquo; Means — and Doesn&apos;t
        </h2>
        <p className="text-sm text-text-secondary">
          PetitionHQ confirms that a researcher profile matching your credentials{" "}
          <strong>exists</strong> in independent public databases. This is different from
          confirming that <em>you</em> own that identity.
        </p>
        <p className="text-sm text-text-secondary">
          Concretely: if OpenAlex returns a profile matching your name, field, and institution
          with a consistent publication count, that profile is &ldquo;publicly corroborated&rdquo;
          — an independent database agrees it exists. We do not confirm you are the person named
          on that profile.
        </p>
        <div className="rounded-lg border border-border-default bg-surface-subtle px-5 py-4 space-y-2">
          <p className="text-sm font-semibold text-text-primary">The one exception: ORCID OAuth</p>
          <p className="text-sm text-text-secondary">
            When you connect your ORCID account directly, you prove <em>ownership</em> of that
            identifier — the credential is issued by ORCID to you personally, not inferred by
            name-matching. We label this &ldquo;identity confirmed&rdquo; rather than
            &ldquo;publicly corroborated.&rdquo; This is a stronger and different claim.
          </p>
        </div>
        <p className="text-sm text-text-secondary">
          Attorney-facing reviews display both the corroboration level and the methodology, so
          attorneys can weigh the evidence for themselves. The trust score makes the
          existence-vs-ownership distinction explicit in every lead.
        </p>
      </section>

      {/* What trust does NOT measure */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight text-text-primary">
          What the Trust Score Does <span className="italic">Not</span> Measure
        </h2>
        <p className="text-sm text-text-secondary">
          Trust answers one question: <em>is this a real, findable researcher
          whose self-reported claims hold up?</em> It is not a measure of how
          strong their NIW case is — case strength is a separate assessment. A
          modest but completely honest researcher can score high on trust and
          still have a borderline case, and vice-versa.
        </p>
        <p className="text-sm text-text-secondary">
          Two guarantees protect honest applicants. First, a database your field
          simply doesn&apos;t use never costs you points — a clinician is not
          penalized for being absent from a computer-science index. Second,
          under-indexing is never read as a lie: if your record shows fewer works
          than you claimed, we treat it as indexing lag, not misrepresentation —
          the only penalty is an egregious overclaim against a record we&apos;ve
          confidently resolved as yours.
        </p>
      </section>

      {/* Refund policy */}
      <section className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight text-text-primary">
          Refund Policy
        </h2>
        <div className="card space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-bg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-success-text"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-text-primary">
                Material misrepresentation
              </p>
              <p className="text-sm text-text-secondary">
                If the verification report reveals that an applicant materially
                misrepresented their credentials, the claiming attorney can
                request a full refund within 30 days. Refund requests are
                reviewed by our team and processed within 5–10 business days.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-bg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5 text-success-text"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium text-text-primary">
                Applicant non-response
              </p>
              <p className="text-sm text-text-secondary">
                If an applicant does not complete intake within 14 days of a
                claim, the attorney is automatically refunded and the lead is
                returned to the available leads pool.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Updated date + back link */}
      <div className="flex items-center justify-between border-t border-border-subtle pt-6">
        <p className="text-xs text-text-muted">
          Last updated: June 9, 2026
        </p>
        <Link
          href="/how-it-works"
          className="text-xs text-text-muted underline hover:text-text-primary"
        >
          How PetitionHQ works →
        </Link>
      </div>
    </div>
  );
}
