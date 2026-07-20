/**
 * Semantic Scholar API client for author verification.
 *
 * Independent cross-check against OpenAlex. Key differentiator:
 * `influentialCitationCount` — citations where the citing paper
 * meaningfully engages with the work, not just bibliography padding.
 * This is gold for EB-2 NIW cases (Dhanasar "national importance" prong).
 *
 * Free tier: 1 req/sec without key, 100 req/sec with key.
 * Docs: https://api.semanticscholar.org/api-docs/
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { SemanticScholarAuthor } from "./types";
import { nameMatchStrength } from "./nameMatch";

// ─── Constants ──────────────────────────────────────────────────────

const BASE_URL = "https://api.semanticscholar.org/graph/v1";
const CACHE_TTL_SECONDS = 86_400; // 24 hours
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_CONFIDENCE = 0.6;

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
  return `s2:author:${hash}`;
}

// ─── S2 API response types (internal) ───────────────────────────────

type S2AuthorMatch = {
  authorId: string;
  name: string;
  paperCount?: number;
  citationCount?: number;
  hIndex?: number;
  affiliations?: string[];
};

type S2AuthorSearchResponse = {
  total: number;
  data: S2AuthorMatch[];
};

type S2AuthorDetail = {
  authorId: string;
  name: string;
  paperCount: number;
  citationCount: number;
  hIndex: number;
  affiliations?: string[];
};

type S2AuthorPapersResponse = {
  total: number;
  data: Array<{
    paperId: string;
    title?: string;
    citationCount?: number;
    influentialCitationCount?: number;
    year?: number;
  }>;
};

// ─── Normalize helpers ──────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function affiliationMatch(affiliations: string[], queryInst: string): boolean {
  const norm = normalizeStr(queryInst);
  return affiliations.some((aff) => {
    const n = normalizeStr(aff);
    return n.includes(norm) || norm.includes(n);
  });
}

// ─── Confidence scoring ─────────────────────────────────────────────
// Name is the primary signal; institution/activity are corroborating
// bonuses, never gates. S2 affiliations are frequently empty even for
// real authors, so gating on them rejected genuine matches.

function scoreCandidate(
  candidate: S2AuthorMatch,
  input: { name: string; institution?: string },
): number {
  const nameStrength = nameMatchStrength(candidate.name, input.name);
  if (nameStrength === 0) return 0;

  // Exact set match = 0.6 = threshold; weaker name needs corroboration.
  let confidence = nameStrength * 0.6;

  // Institution match: +0.25 (when S2 actually reports affiliations)
  if (input.institution && candidate.affiliations?.length) {
    if (affiliationMatch(candidate.affiliations, input.institution)) {
      confidence += 0.25;
    }
  }

  // Active researcher with real impact: small nudges.
  if ((candidate.paperCount ?? 0) > 0) confidence += 0.05;
  if ((candidate.citationCount ?? 0) > 10) confidence += 0.1;

  return Math.round(Math.min(confidence, 1) * 100) / 100;
}

// ─── HTTP helper ────────────────────────────────────────────────────

async function s2Fetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": POLITE_USER_AGENT };

  // Use API key if available (100 req/sec vs 1 req/sec)
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  try {
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
    });

    if (res.status === 429) {
      logger.warn("[semantic-scholar] Rate-limited (429)");
      throw new Error("Semantic Scholar rate limit hit");
    }

    if (!res.ok) {
      throw new Error(`Semantic Scholar HTTP ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Find a researcher on Semantic Scholar by name + optional institution.
 * Returns the best match above the confidence threshold, or null.
 *
 * The returned object includes `influentialCitationCount` — the total
 * number of influential citations across the author's papers.
 */
export async function findAuthor(input: {
  name: string;
  institution?: string;
}): Promise<SemanticScholarAuthor | null> {
  const r = getRedis();
  const key = cacheKey(JSON.stringify(input));

  // Check cache
  if (r) {
    try {
      const cached = await r.get<SemanticScholarAuthor | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[semantic-scholar] Cache hit for", input.name);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[semantic-scholar] Cache read failed:", e);
    }
  }

  try {
    // Step 1: Author search
    const searchQuery = encodeURIComponent(input.name);
    const data = await s2Fetch<S2AuthorSearchResponse>(
      `/author/search?query=${searchQuery}&limit=10&fields=authorId,name,paperCount,citationCount,hIndex,affiliations`,
    );

    if (!data.data || data.data.length === 0) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    // Step 2: Score candidates, pick best above threshold
    let bestMatch: { candidate: S2AuthorMatch; confidence: number } | null = null;

    for (const candidate of data.data) {
      const confidence = scoreCandidate(candidate, input);
      if (confidence >= MIN_CONFIDENCE && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { candidate, confidence };
      }
    }

    if (!bestMatch) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const { candidate, confidence } = bestMatch;

    // Step 3: Fetch top papers to compute influentialCitationCount
    let influentialCitationCount = 0;
    try {
      const papers = await s2Fetch<S2AuthorPapersResponse>(
        `/author/${candidate.authorId}/papers?limit=100&fields=paperId,title,citationCount,influentialCitationCount,year`,
      );

      influentialCitationCount = papers.data.reduce(
        (sum, p) => sum + (p.influentialCitationCount ?? 0),
        0,
      );
    } catch (e) {
      logger.warn("[semantic-scholar] Papers fetch failed (non-fatal):", e);
    }

    const result: SemanticScholarAuthor = {
      id: candidate.authorId,
      displayName: candidate.name,
      paperCount: candidate.paperCount ?? 0,
      citationCount: candidate.citationCount ?? 0,
      hIndex: candidate.hIndex ?? 0,
      influentialCitationCount,
      sourceUrl: `https://www.semanticscholar.org/author/${candidate.authorId}`,
      confidence,
    };

    // Cache
    if (r) { try { await r.set(key, result, { ex: CACHE_TTL_SECONDS }); } catch {} }

    return result;
  } catch (e) {
    logger.error("[semantic-scholar] findAuthor failed:", e);
    return null;
  }
}
