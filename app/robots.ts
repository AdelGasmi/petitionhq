import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt — controls crawl access for search engines and GenAI bots.
 *
 * Strategy:
 *  - Allow all general crawlers on public marketing content.
 *  - Explicitly allow major GenAI training/answer-engine bots on the same
 *    public content (GPTBot, ClaudeBot, anthropic-ai, PerplexityBot,
 *    Google-Extended, CCBot, Applebot-Extended, Bytespider, Amazonbot, Meta-ExternalAgent).
 *  - Disallow private/authenticated areas across all bots: /api, /admin,
 *    /cases, /profile, /network, /onboarding, /intake, /respond, /review,
 *    /results, /guest, /verify, /login, /signup, /setup, /invite, /leads.
 */
export default function robots(): MetadataRoute.Robots {
  const DISALLOW = [
    "/api/",
    "/admin/",
    "/check/result/", // personal assessment result pages — never index
    "/cases/",
    "/profile/",
    "/network/",
    "/onboarding/",
    "/intake/",
    "/respond/",
    "/review/",
    "/results/",
    "/guest/",
    "/verify/",
    "/login",
    "/signup",
    "/setup/",
    "/invite/",
    "/leads/",
    "/forms/",
  ];

  // GenAI / answer-engine crawlers — listed explicitly so the policy is
  // legible and easy to flip later if pricing / licensing changes.
  const AI_BOTS = [
    "GPTBot",            // OpenAI training crawler
    "ChatGPT-User",      // ChatGPT live browsing
    "OAI-SearchBot",     // OpenAI SearchGPT
    "ClaudeBot",         // Anthropic training crawler
    "Claude-Web",        // Anthropic live retrieval
    "anthropic-ai",      // legacy Anthropic UA
    "PerplexityBot",     // Perplexity indexer
    "Perplexity-User",   // Perplexity live retrieval
    "Google-Extended",   // Google Gemini training opt-in
    "CCBot",             // Common Crawl (feeds many LLMs)
    "Applebot-Extended", // Apple Intelligence training opt-in
    "Bytespider",        // ByteDance / Doubao
    "Amazonbot",         // Amazon
    "Meta-ExternalAgent",// Meta AI
    "DuckAssistBot",     // DuckDuckGo AI
    "MistralAI-User",    // Mistral
    "cohere-ai",         // Cohere
    "YouBot",            // You.com
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: DISALLOW },
      ...AI_BOTS.map((ua) => ({ userAgent: ua, allow: "/", disallow: DISALLOW })),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
