import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { ARTICLES } from "@/content/articles";

/**
 * Public sitemap for Google + Bing + GenAI crawlers.
 *
 * Only list pages that are (a) publicly reachable without auth and
 * (b) primarily content (not user dashboards or token-gated flows).
 * Adjust changeFrequency/priority per the page's editorial cadence.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Real per-route last-modified dates — bump when a route's content
  // materially changes. Never use new Date(): a sitemap that claims every
  // page changed today is fake freshness and erodes crawler trust.
  const routes: Array<{
    path: string;
    priority: number;
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
    lastModified: string;
  }> = [
    { path: "/", priority: 1.0, changeFrequency: "weekly", lastModified: "2026-06-09" },
    { path: "/check", priority: 0.95, changeFrequency: "monthly", lastModified: "2026-06-09" },
    { path: "/eb2-niw-guide", priority: 0.9, changeFrequency: "monthly", lastModified: "2026-06-09" },
    { path: "/eb2-niw-vs-eb1a", priority: 0.85, changeFrequency: "monthly", lastModified: "2026-06-11" },
    { path: "/eb2-niw-processing-time", priority: 0.85, changeFrequency: "monthly", lastModified: "2026-06-11" },
    { path: "/visa-categories", priority: 0.85, changeFrequency: "monthly", lastModified: "2026-06-09" },
    { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-06-01" },
    { path: "/for-attorneys", priority: 0.8, changeFrequency: "monthly", lastModified: "2026-06-01" },
    { path: "/verification", priority: 0.6, changeFrequency: "monthly", lastModified: "2026-06-08" },
    { path: "/about", priority: 0.7, changeFrequency: "monthly", lastModified: "2026-06-01" },
    { path: "/faq", priority: 0.75, changeFrequency: "monthly", lastModified: "2026-06-01" },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-02-01" },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-02-01" },
  ];

  const articleRoutes = ARTICLES.map((a) => ({
    url: `${SITE_URL}/articles/${a.meta.slug}`,
    lastModified: a.meta.dateModified,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const indexRoute = {
    url: `${SITE_URL}/articles`,
    lastModified: ARTICLES[0]?.meta.dateModified ?? "2026-06-11",
    changeFrequency: "weekly" as const,
    priority: 0.75,
  };

  return [
    ...routes.map((r) => ({
      url: `${SITE_URL}${r.path === "/" ? "" : r.path}`,
      lastModified: r.lastModified,
      changeFrequency: r.changeFrequency,
      priority: r.priority,
    })),
    indexRoute,
    ...articleRoutes,
  ];
}
