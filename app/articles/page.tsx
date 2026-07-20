import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbSchema } from "@/components/seo/schemas";
import { canonical, BRAND } from "@/lib/seo";
import { ARTICLES, type ArticleMeta } from "@/content/articles";

export const metadata: Metadata = {
  title: `EB-2 NIW Articles — ${BRAND.name}`,
  description: "Practical guides on EB-2 NIW petitions: RFE responses, denial patterns, citations, recommendation letters, and proposed-endeavor strategy. Honest, no-sales-call.",
  alternates: { canonical: canonical("/articles") },
  openGraph: {
    title: `EB-2 NIW Articles — ${BRAND.name}`,
    description: "Practical guides on EB-2 NIW petitions — RFE responses, denial patterns, citations, and more.",
    type: "website",
  },
};

const PILLARS: Array<{
  id: ArticleMeta["pillar"];
  label: string;
  description: string;
}> = [
  { id: "eligibility", label: "Am I eligible?", description: "Qualifying routes, proposed-endeavor requirements, and field-specific paths" },
  { id: "evidence-building", label: "Building evidence", description: "Citations, recommendation letters, and what USCIS actually evaluates" },
  { id: "filing-timeline", label: "Filing & timeline", description: "Processing times, fees, premium processing, and total cost breakdown" },
  { id: "rfe-denial", label: "RFE & denial", description: "Understanding and responding to requests for evidence and denial reasons" },
];

function readTime(n: number) {
  return `${n} min read`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function ArticleCard({ meta }: { meta: ArticleMeta }) {
  return (
    <Link
      href={`/articles/${meta.slug}`}
      className="card card-interactive flex flex-col gap-3 h-full no-underline hover:no-underline"
    >
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <time dateTime={meta.datePublished}>{formatDate(meta.datePublished)}</time>
        <span aria-hidden>·</span>
        <span>{readTime(meta.readMinutes)}</span>
      </div>
      <h3 className="font-serif text-lg font-bold text-text-primary leading-snug">
        {meta.title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed flex-1">
        {meta.dek}
      </p>
      <span className="text-sm font-semibold text-text-link mt-auto">
        Read article →
      </span>
    </Link>
  );
}

export default function ArticlesIndexPage() {
  const byPillar = new Map<ArticleMeta["pillar"], ArticleMeta[]>();
  const unpillar: ArticleMeta[] = [];

  for (const { meta } of ARTICLES) {
    if (meta.pillar) {
      const group = byPillar.get(meta.pillar) ?? [];
      group.push(meta);
      byPillar.set(meta.pillar, group);
    } else {
      unpillar.push(meta);
    }
  }

  return (
    <>
      <JsonLd data={breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Articles", path: "/articles" },
      ])} />

      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10 space-y-12">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-text-muted">
            <li><Link href="/" className="hover:text-text-primary">Home</Link></li>
            <li aria-hidden>/</li>
            <li className="text-text-secondary">Articles</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="max-w-2xl">
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text-primary">
            EB-2 NIW guides & analysis
          </h1>
          <p className="mt-3 text-base text-text-secondary leading-relaxed">
            Practical, honest guides on NIW petitions — scored against the same{" "}
            <em>Matter of Dhanasar</em> framework USCIS uses. No sales calls.
            No &ldquo;talk to an expert&rdquo; walls.
          </p>
        </div>

        {/* Articles grouped by pillar */}
        {PILLARS.map((pillar) => {
          const articles = byPillar.get(pillar.id);
          if (!articles || articles.length === 0) return null;
          return (
            <section key={pillar.id}>
              <div className="mb-4">
                <h2 className="font-serif text-xl font-bold text-text-primary">{pillar.label}</h2>
                <p className="mt-1 text-sm text-text-muted">{pillar.description}</p>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2">
                {articles.map((meta) => (
                  <li key={meta.slug}>
                    <ArticleCard meta={meta} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {/* Unpillar'd articles (fallback) */}
        {unpillar.length > 0 && (
          <section>
            <h2 className="font-serif text-xl font-bold text-text-primary mb-4">More articles</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {unpillar.map((meta) => (
                <li key={meta.slug}>
                  <ArticleCard meta={meta} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTA */}
        <div className="card-feature flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-text-inverted">See where your case actually stands</p>
            <p className="text-sm text-text-inverted opacity-80 mt-1">
              Free 5-minute assessment scored against the Dhanasar prongs.
            </p>
          </div>
          <Link href="/check" className="btn btn-inverted shrink-0">
            Check my NIW odds — free
          </Link>
        </div>
      </div>
    </>
  );
}
