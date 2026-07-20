/**
 * PubMed (NCBI E-utilities) client for biomedical author verification.
 *
 * PubMed indexes biomedical/life-sciences literature that OpenAlex and
 * Semantic Scholar cover unevenly — it's the field-primary source for
 * biomed researchers, the same role DBLP plays for CS. Keyless and free
 * at low volume; we identify ourselves via tool + email params.
 *
 * Docs: https://www.ncbi.nlm.nih.gov/books/NBK25500/
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_MAILTO } from "./types";
import type { PubmedResult } from "./types";

const BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const CACHE_TTL_SECONDS = 86_400;
const REQUEST_TIMEOUT_MS = 8_000;
const TOOL_NAME = "PetitionHQ";

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
  return `pubmed:author:${hash}`;
}

type ESearchResponse = {
  esearchresult?: { count?: string; idlist?: string[] };
};

async function esearchCount(term: string): Promise<number> {
  const url = new URL(`${BASE_URL}/esearch.fcgi`);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", term);
  url.searchParams.set("retmode", "json");
  url.searchParams.set("retmax", "0");
  url.searchParams.set("tool", TOOL_NAME);
  url.searchParams.set("email", POLITE_MAILTO);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (res.status === 429) throw new Error("PubMed rate limit hit");
    if (!res.ok) throw new Error(`PubMed HTTP ${res.status}`);
    const data = (await res.json()) as ESearchResponse;
    return parseInt(data.esearchresult?.count ?? "0", 10) || 0;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Find an author's PubMed footprint by name. Returns total indexed-article
 * count plus a recent (last 5y) count, or null if nothing is found.
 *
 * Note: PubMed author search is name-based and not disambiguated, so this
 * is a corroborating signal (does a biomed footprint exist for this name?),
 * not an identity-grade match. The trust model treats it accordingly.
 */
export async function findAuthor(input: {
  name: string;
}): Promise<PubmedResult | null> {
  const name = input.name.trim();
  if (!name) return null;

  const r = getRedis();
  const key = cacheKey(name);
  if (r) {
    try {
      const cached = await r.get<PubmedResult | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[pubmed] Cache hit for", name);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[pubmed] Cache read failed:", e);
    }
  }

  try {
    const authorTerm = `${name}[Author]`;
    const total = await esearchCount(authorTerm);

    if (total === 0) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const currentYear = new Date().getFullYear();
    const recentTerm = `${authorTerm} AND ${currentYear - 5}:${currentYear}[pdat]`;
    let recentCount = 0;
    try {
      recentCount = await esearchCount(recentTerm);
    } catch (e) {
      logger.warn("[pubmed] Recent count fetch failed (non-fatal):", e);
    }

    const result: PubmedResult = {
      authorName: name,
      paperCount: total,
      recentCount,
      topJournals: [],
      sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(authorTerm)}`,
      confidence: 0.6,
    };

    if (r) { try { await r.set(key, result, { ex: CACHE_TTL_SECONDS }); } catch {} }
    return result;
  } catch (e) {
    logger.error("[pubmed] findAuthor failed:", e);
    return null;
  }
}
