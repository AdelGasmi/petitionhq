import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleSchema, breadcrumbSchema, faqSchema } from "@/components/seo/schemas";
import { canonical, SITE_URL } from "@/lib/seo";
import { ARTICLES, ARTICLES_BY_SLUG } from "@/content/articles";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.meta.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLES_BY_SLUG.get(slug);
  if (!article) return {};
  const { meta } = article;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: canonical(`/articles/${slug}`) },
    openGraph: {
      title: meta.title,
      description: meta.description,
      type: "article",
      publishedTime: meta.datePublished,
      modifiedTime: meta.dateModified,
      url: `${SITE_URL}/articles/${slug}`,
    },
  };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLES_BY_SLUG.get(slug);
  if (!article) notFound();

  const { meta, Body } = article;

  const relatedArticles = meta.relatedSlugs
    .map((s) => ARTICLES_BY_SLUG.get(s))
    .filter((a): a is NonNullable<typeof a> => !!a);

  const showToC = meta.readMinutes >= 6 && meta.tableOfContents && meta.tableOfContents.length > 0;

  return (
    <>
      <JsonLd data={articleSchema({
        title: meta.title,
        description: meta.description,
        path: `/articles/${slug}`,
        datePublished: meta.datePublished,
        dateModified: meta.dateModified,
        sources: meta.sources,
      })} />
      <JsonLd data={breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Articles", path: "/articles" },
        { name: meta.title, path: `/articles/${slug}` },
      ])} />
      {meta.faqs && meta.faqs.length > 0 && (
        <JsonLd data={faqSchema(meta.faqs)} />
      )}

      <div className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex items-center gap-1.5 text-sm text-text-muted flex-wrap">
            <li><Link href="/" className="hover:text-text-primary">Home</Link></li>
            <li aria-hidden>/</li>
            <li><Link href="/articles" className="hover:text-text-primary">Articles</Link></li>
            <li aria-hidden>/</li>
            <li className="text-text-secondary truncate max-w-[200px]">{meta.title}</li>
          </ol>
        </nav>

        <div className="lg:grid lg:grid-cols-[1fr_260px] lg:gap-12 lg:items-start">
          {/* Main column */}
          <article>
            {/* Article header */}
            <header className="mb-8">
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-text-primary leading-tight mb-4">
                {meta.title}
              </h1>
              <p className="text-lg text-text-secondary leading-relaxed mb-4">{meta.dek}</p>
              <div className="flex items-center gap-3 text-sm text-text-muted border-t border-border-default pt-4 flex-wrap">
                <span>By PetitionHQ</span>
                <span aria-hidden>·</span>
                <time dateTime={meta.datePublished}>{formatDate(meta.datePublished)}</time>
                {meta.dateModified !== meta.datePublished && (
                  <>
                    <span aria-hidden>·</span>
                    <span>Updated <time dateTime={meta.dateModified}>{formatDate(meta.dateModified)}</time></span>
                  </>
                )}
                <span aria-hidden>·</span>
                <span>{meta.readMinutes} min read</span>
              </div>
            </header>

            {/* TL;DR answer box */}
            {meta.tldr && (
              <div className="not-prose mb-8 rounded-xl border border-info-border bg-info-bg px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-info-text mb-1.5">TL;DR</p>
                <p className="text-sm leading-relaxed text-info-text">{meta.tldr}</p>
              </div>
            )}

            {/* Key takeaways */}
            {meta.takeaways && meta.takeaways.length > 0 && (
              <div className="not-prose mb-8 rounded-xl border border-border-default bg-surface-secondary px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">Key takeaways</p>
                <ul className="space-y-2">
                  {meta.takeaways.map((t, i) => (
                    <li key={i} className="flex gap-2.5 text-sm text-text-secondary">
                      <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-success-bg flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-success-text" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Article body */}
            <Body />

            {/* FAQ section */}
            {meta.faqs && meta.faqs.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border-default">
                <h2 className="font-serif text-2xl font-bold text-text-primary mb-4">
                  Frequently asked questions
                </h2>
                <div className="space-y-3">
                  {meta.faqs.map((faq) => (
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
              </section>
            )}

            {/* Sources footer — E-E-A-T + AI citation anchors */}
            {meta.sources && meta.sources.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border-default">
                <h2 className="font-serif text-lg font-bold text-text-primary mb-3">Sources</h2>
                <ul className="space-y-1.5">
                  {meta.sources.map((src) => (
                    <li key={src.url} className="text-sm">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-text-link hover:underline"
                      >
                        {src.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Related articles */}
            {relatedArticles.length > 0 && (
              <section className="mt-12 pt-8 border-t border-border-default">
                <h2 className="font-serif text-xl font-bold text-text-primary mb-4">Related articles</h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {relatedArticles.map(({ meta: rm }) => (
                    <li key={rm.slug}>
                      <Link
                        href={`/articles/${rm.slug}`}
                        className="card card-interactive block no-underline hover:no-underline"
                      >
                        <p className="text-xs text-text-muted mb-1">{rm.readMinutes} min read</p>
                        <p className="text-sm font-semibold text-text-primary leading-snug">{rm.title}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          {/* Right rail — sticky ToC + CTA */}
          <aside className="hidden lg:block sticky top-6 space-y-4">
            {/* Table of contents for long articles */}
            {showToC && (
              <nav aria-label="Table of contents" className="card">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-3">On this page</p>
                <ol className="space-y-2">
                  {meta.tableOfContents!.map((item, i) => (
                    <li key={item.anchor}>
                      <a
                        href={`#${item.anchor}`}
                        className="flex gap-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors no-underline"
                      >
                        <span className="shrink-0 text-text-muted tabular-nums">{i + 1}.</span>
                        <span>{item.heading}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            )}

            <div className="card-feature space-y-4">
              <p className="font-semibold text-text-inverted">Know your odds before you file</p>
              <p className="text-sm text-text-inverted opacity-80 leading-relaxed">
                Free 5-minute assessment scored against the Dhanasar prongs — honest result,
                including &ldquo;not yet ready.&rdquo;
              </p>
              <Link href="/check" className="btn btn-inverted w-full text-center text-sm">
                Check my NIW case — free
              </Link>
              <p className="text-xs text-text-inverted opacity-60">No account. No sales call.</p>
            </div>
          </aside>
        </div>

        {/* Bottom CTA band — mobile + desktop */}
        <div className="mt-16 card-feature flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:hidden">
          <div>
            <p className="font-semibold text-text-inverted">See where your case stands</p>
            <p className="text-sm text-text-inverted opacity-80 mt-1">Honest, free, 5 minutes.</p>
          </div>
          <Link href="/check" className="btn btn-inverted shrink-0">
            Start free assessment →
          </Link>
        </div>
      </div>
    </>
  );
}
