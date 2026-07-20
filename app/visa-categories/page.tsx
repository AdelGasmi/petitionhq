import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleSchema, breadcrumbSchema } from "@/components/seo/schemas";
import { canonical } from "@/lib/seo";

const TITLE = "EB-2 NIW in Context: Which U.S. Visa Category Fits You?";
const DESCRIPTION =
  "Plain-English primer on EB-1A, EB-1B, EB-2 NIW, O-1, EB-3 — what each category requires and how to choose. PetitionHQ currently supports EB-2 NIW.";
const PATH = "/visa-categories";
const PUBLISHED = "2026-02-01";
// Real last-modified date — bump when this reference materially changes.
// Never use new Date(): it fakes daily freshness and erodes crawler trust.
const MODIFIED = "2026-06-09";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "EB-2 NIW vs EB-1A",
    "EB-2 NIW vs O-1",
    "EB-1A",
    "EB-1B",
    "O-1 visa",
    "EB-3",
    "I-130",
    "U.S. visa categories",
    "which U.S. visa is right for me",
  ],
  alternates: { canonical: canonical(PATH) },
  openGraph: { title: TITLE, description: DESCRIPTION, url: canonical(PATH), type: "article" },
};

const CATEGORIES = [
  {
    code: "EB-2 NIW",
    name: "National Interest Waiver",
    status: "supported",
    type: "Immigrant (green card)",
    sponsor: "Self-petition — no employer required",
    bar: "Three Matter of Dhanasar prongs: merit + national importance, well-positioned to advance, on-balance benefit to U.S.",
    timeline: "Premium processing: 45 business days. Standard: 8–14 months.",
    audience: "Researchers, engineers, healthcare professionals, founders with national-level impact",
    fitNote: "PetitionHQ currently focuses exclusively on EB-2 NIW.",
  },
  {
    code: "EB-1A",
    name: "Extraordinary Ability",
    status: "roadmap",
    type: "Immigrant (green card)",
    sponsor: "Self-petition — no employer required",
    bar: "Top of field. Either a one-time major international award (Nobel, Olympic medal, Oscar) or 3 of 10 Kazarian criteria.",
    timeline: "Premium processing: 15 business days. Standard: 6–12 months.",
    audience: "Senior researchers, awardees, founders with international recognition",
    fitNote: "On the PetitionHQ roadmap. Currently the strongest EB-1A profiles can use the EB-2 NIW assessment as a fallback or parallel filing.",
  },
  {
    code: "EB-1B",
    name: "Outstanding Researcher",
    status: "roadmap",
    type: "Immigrant (green card)",
    sponsor: "Employer-sponsored — tenure-track offer or qualifying private-sector research role",
    bar: "International recognition + 3+ years research experience + qualifying offer. 2 of 6 regulatory criteria.",
    timeline: "Premium processing: 15 business days. Standard: 6–12 months.",
    audience: "Tenure-track researchers, senior industry research roles",
    fitNote: "On the roadmap. Often filed in parallel with EB-1A for senior researchers.",
  },
  {
    code: "O-1A / O-1B",
    name: "Extraordinary Ability (Nonimmigrant)",
    status: "roadmap",
    type: "Nonimmigrant work visa, 3-year term, renewable",
    sponsor: "U.S. employer or agent",
    bar: "Major international award or 3 of 8 regulatory criteria. O-1A: sciences, education, business, athletics. O-1B: arts/film/TV.",
    timeline: "Premium processing: 15 business days. Standard: 2–3 months.",
    audience: "Individuals with extraordinary ability who need a 3-year work visa while building toward EB-1A or EB-2 NIW",
    fitNote: "On the roadmap. Frequently used as a 'bridge' visa while preparing the green-card self-petition.",
  },
  {
    code: "EB-2 / EB-3 PERM",
    name: "Employer-Sponsored Green Card",
    status: "out-of-scope",
    type: "Immigrant (green card)",
    sponsor: "U.S. employer + Department of Labor PERM certification",
    bar: "Job offer + PERM-tested labor-market recruitment",
    timeline: "PERM 12–18 months + I-140 6–12 months + priority-date wait",
    audience: "Workers without standout independent achievements; cleanest fit is employer-driven",
    fitNote: "Not on the PetitionHQ roadmap. PERM-driven cases are best served by a specialist firm.",
  },
  {
    code: "I-130",
    name: "Family-Based Petition",
    status: "out-of-scope",
    type: "Immigrant (green card)",
    sponsor: "U.S. citizen or lawful permanent resident family member",
    bar: "Qualifying family relationship (spouse, parent, child, sibling)",
    timeline: "Immediate relatives current; other categories per Visa Bulletin",
    audience: "Family members of USCs/LPRs",
    fitNote: "Not on the PetitionHQ roadmap.",
  },
];

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  supported: { label: "Supported today", cls: "bg-success-soft text-success-text" },
  roadmap: { label: "On the roadmap", cls: "bg-warning-soft text-warning-text" },
  "out-of-scope": { label: "Out of scope", cls: "bg-surface-muted text-text-secondary" },
};

export default function VisaCategoriesPage() {
  return (
    <article className="mx-auto max-w-4xl">
      <JsonLd data={articleSchema({ title: TITLE, description: DESCRIPTION, path: PATH, datePublished: PUBLISHED, dateModified: MODIFIED })} />
      <JsonLd data={breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Visa Categories", path: PATH }])} />

      <nav aria-label="Breadcrumb" className="mb-6 text-xs text-text-muted">
        <Link href="/" className="hover:text-text-primary">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-text-secondary">Visa Categories</span>
      </nav>

      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Reference · Updated {MODIFIED}</p>
        <h1 className="mt-2 font-serif text-4xl sm:text-5xl font-bold tracking-tight">
          U.S. visa categories, plain-English.
        </h1>
        <p className="mt-4 text-lg text-text-secondary leading-relaxed">
          Six categories, what each requires, and who it fits.
        </p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-primary">Check your EB-2 NIW eligibility — free</Link>
        </div>
      </header>

      {/* Scope disclosure — honest, prominent, BCG-style */}
      <aside className="mb-10 rounded-lg border-l-4 border-border-inverted bg-surface-subtle p-5">
        <p className="text-sm font-semibold text-text-primary">PetitionHQ scope: EB-2 NIW today.</p>
        <p className="mt-2 text-sm text-text-secondary leading-relaxed">
          We are focused exclusively on the EB-2 National Interest Waiver in V1 — so the scoring engine, evidence framework, and attorney-matching layer can be best-in-class for one category before we broaden.
          EB-1A, EB-1B, and O-1 are on the roadmap and clearly marked below. PERM-driven and family-based petitions are out of scope.
        </p>
      </aside>

      <div className="space-y-6">
        {CATEGORIES.map((c) => (
          <section key={c.code} className="rounded-lg border border-border-default bg-surface-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl font-bold tracking-tight">
                <span className="rounded bg-brand-primary px-2 py-1 text-base text-brand-on-primary align-middle mr-2">{c.code}</span>
                {c.name}
              </h2>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CHIP[c.status]?.cls}`}>
                {STATUS_CHIP[c.status]?.label}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-muted">{c.type}</p>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-text-muted">Sponsor</dt><dd className="text-text-primary">{c.sponsor}</dd></div>
              <div><dt className="text-text-muted">Timeline</dt><dd className="text-text-primary">{c.timeline}</dd></div>
              <div className="sm:col-span-2"><dt className="text-text-muted">Bar</dt><dd className="text-text-primary">{c.bar}</dd></div>
              <div className="sm:col-span-2"><dt className="text-text-muted">Typical audience</dt><dd className="text-text-primary">{c.audience}</dd></div>
            </dl>
            <p className="mt-4 text-sm italic text-text-secondary border-t border-border-subtle pt-3">{c.fitNote}</p>
          </section>
        ))}
      </div>

      <section className="mt-12 rounded-2xl bg-surface-inverted px-6 py-10 text-text-inverted text-center sm:px-12">
        <h2 className="font-serif text-2xl font-bold tracking-tight">EB-2 NIW looks like the fit?</h2>
        <p className="mt-2 text-text-disabled">Take the free, 5-minute case-strength assessment scored against the Matter of Dhanasar framework.</p>
        <div className="mt-5">
          <Link href="/check" className="btn btn-inverted">
            Start the NIW assessment →
          </Link>
        </div>
      </section>
    </article>
  );
}
