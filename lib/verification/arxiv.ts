/**
 * arXiv API client for preprint verification.
 *
 * Catches bleeding-edge publications that haven't yet been indexed by
 * OpenAlex or Semantic Scholar. Critical for AI/ML, Physics, and Math
 * researchers who often pre-publish months before formal publication.
 *
 * 100% free, no API key, HTTP GET. Returns Atom XML.
 * Rate limit: ~3 req/sec (be polite).
 * Docs: https://info.arxiv.org/help/api/user-manual.html
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { ArxivResult } from "./types";

// ─── Constants ──────────────────────────────────────────────────────

const BASE_URL = "https://export.arxiv.org/api/query";
const CACHE_TTL_SECONDS = 86_400;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 20;
const MIN_CONFIDENCE = 0.5;

// ─── Redis singleton (lazy) ─────────────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

function cacheKey(input: string): string {
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `arxiv:author:${hash}`;
}

// ─── Atom XML parsing (lightweight, no dependency) ──────────────────

type ArxivEntry = {
  id: string;
  title: string;
  published: string;
  authors: string[];
  categories: string[];
};

function extractText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function parseEntries(xml: string): ArxivEntry[] {
  // Split on <entry> tags
  const entryBlocks = xml.split(/<entry>/);
  entryBlocks.shift(); // remove everything before first <entry>

  return entryBlocks.map((block) => {
    const entryXml = block.split(/<\/entry>/)[0];

    // Extract arXiv ID from <id> (format: http://arxiv.org/abs/2301.07041v1)
    const rawId = extractText(entryXml, "id");
    const idMatch = rawId.match(/abs\/(.+?)(?:v\d+)?$/);
    const id = idMatch ? idMatch[1] : rawId;

    // Extract title (may have newlines)
    const title = extractText(entryXml, "title").replace(/\s+/g, " ");

    // Extract published date
    const published = extractText(entryXml, "published");

    // Extract author names: <author><name>...</name></author>
    const authorBlocks = entryXml.match(/<author>[\s\S]*?<\/author>/g) ?? [];
    const authors = authorBlocks.map((ab) => extractText(ab, "name"));

    // Extract categories: <category term="cs.LG" ... />
    const catMatches = entryXml.matchAll(/term="([^"]+)"/g);
    const categories: string[] = [];
    for (const cm of catMatches) {
      if (cm[1] && !cm[1].includes("://")) {
        categories.push(cm[1]);
      }
    }

    return { id, title, published, authors, categories };
  });
}

function parseTotalResults(xml: string): number {
  const m = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
  return m ? parseInt(m[1], 10) : 0;
}

// ─── Confidence scoring ─────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function authorNameMatch(entryAuthors: string[], queryName: string): boolean {
  const normQuery = normalizeStr(queryName);
  const queryParts = normQuery.split(" ");
  const queryLast = queryParts[queryParts.length - 1];
  const queryFirst = queryParts[0];

  return entryAuthors.some((author) => {
    const normAuthor = normalizeStr(author);
    if (normAuthor === normQuery) return true;

    const authorParts = normAuthor.split(" ");
    if (authorParts.length >= 2) {
      const authorLast = authorParts[authorParts.length - 1];
      const authorFirst = authorParts[0];
      return authorLast === queryLast && (authorFirst === queryFirst || authorFirst[0] === queryFirst[0]);
    }
    return false;
  });
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Search arXiv for papers by a given author.
 * Returns matched papers with categories and confidence score.
 *
 * The arXiv API uses Lucene-style queries. We search by author name
 * and optionally narrow by category if a field mapping is available.
 */
export async function findPapers(input: {
  name: string;
  field?: string;
}): Promise<ArxivResult | null> {
  const r = getRedis();
  const key = cacheKey(JSON.stringify(input));

  // Check cache
  if (r) {
    try {
      const cached = await r.get<ArxivResult | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[arxiv] Cache hit for", input.name);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[arxiv] Cache read failed:", e);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Build author search query — arXiv uses au: prefix
    const searchQuery = `au:"${input.name}"`;
    const url = `${BASE_URL}?search_query=${encodeURIComponent(searchQuery)}&start=0&max_results=${MAX_RESULTS}&sortBy=submittedDate&sortOrder=descending`;

    const res = await fetch(url, {
      headers: { Accept: "application/atom+xml", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`arXiv HTTP ${res.status}: ${res.statusText}`);
    }

    const xml = await res.text();
    const totalResults = parseTotalResults(xml);

    if (totalResults === 0) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const entries = parseEntries(xml);

    // Filter entries where the query name actually appears as an author
    // (arXiv search can be fuzzy)
    const matchedEntries = entries.filter((e) => authorNameMatch(e.authors, input.name));

    if (matchedEntries.length === 0) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    // Compute confidence
    let confidence = 0.4; // base for name match in arXiv

    // Multiple papers → higher confidence the author is real
    if (matchedEntries.length >= 3) confidence += 0.2;
    else if (matchedEntries.length >= 1) confidence += 0.1;

    // Recent paper (within 2 years) → active researcher
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const hasRecent = matchedEntries.some(
      (e) => new Date(e.published) > twoYearsAgo,
    );
    if (hasRecent) confidence += 0.1;

    // Field alignment (if provided)
    if (input.field) {
      const fieldLower = input.field.toLowerCase();
      const allCategories = matchedEntries.flatMap((e) => e.categories);
      const fieldMatch = allCategories.some((cat) => {
        const catLower = cat.toLowerCase();
        // Map common fields to arXiv category prefixes
        if (fieldLower.includes("machine learning") || fieldLower.includes("artificial intelligence")) {
          return catLower.startsWith("cs.lg") || catLower.startsWith("cs.ai") || catLower.startsWith("stat.ml");
        }
        if (fieldLower.includes("computer") || fieldLower.includes("data science")) {
          return catLower.startsWith("cs.");
        }
        if (fieldLower.includes("physics")) return catLower.startsWith("physics.") || catLower.startsWith("hep-");
        if (fieldLower.includes("math")) return catLower.startsWith("math.");
        if (fieldLower.includes("biology") || fieldLower.includes("biomedical")) return catLower.startsWith("q-bio.");
        if (fieldLower.includes("economics") || fieldLower.includes("finance")) return catLower.startsWith("econ.") || catLower.startsWith("q-fin.");
        if (fieldLower.includes("statistics")) return catLower.startsWith("stat.");
        if (fieldLower.includes("electrical") || fieldLower.includes("signal")) return catLower.startsWith("eess.");
        return false;
      });
      if (fieldMatch) confidence += 0.1;
    }

    confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

    if (confidence < MIN_CONFIDENCE) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const result: ArxivResult = {
      authorName: input.name,
      paperCount: matchedEntries.length,
      papers: matchedEntries.slice(0, 10).map((e) => ({
        id: e.id,
        title: e.title,
        published: e.published,
        categories: e.categories,
      })),
      sourceUrl: `https://arxiv.org/search/?searchtype=author&query=${encodeURIComponent(input.name)}`,
      confidence,
    };

    if (r) { try { await r.set(key, result, { ex: CACHE_TTL_SECONDS }); } catch {} }

    return result;
  } catch (e) {
    logger.error("[arxiv] findPapers failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
