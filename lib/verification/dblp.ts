/**
 * DBLP API client for CS conference/journal verification.
 *
 * DBLP is the undisputed source of truth for computer science venues.
 * Conferences (NeurIPS, CVPR, AAAI) are more prestigious than journals
 * in CS — general academic APIs often miss or misclassify these.
 *
 * 100% free, no API key, HTTP GET, returns JSON.
 * Rate limit: polite usage, no hard limit documented.
 * Docs: https://dblp.org/faq/How+to+use+the+dblp+search+API.html
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { DblpResult } from "./types";

// ─── Constants ──────────────────────────────────────────────────────

const AUTHOR_SEARCH_URL = "https://dblp.org/search/author/api";
const PERSON_URL = "https://dblp.org/pid";
const CACHE_TTL_SECONDS = 86_400;
const REQUEST_TIMEOUT_MS = 8_000;
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
  return `dblp:author:${hash}`;
}

// ─── DBLP API response types (internal) ─────────────────────────────

type DblpAuthorHit = {
  info: {
    author: string;
    url?: string;
    aliases?: { alias?: string | string[] };
    notes?: {
      note?: {
        "@type"?: string;
        text?: string;
      } | Array<{ "@type"?: string; text?: string }>;
    };
  };
};

type DblpAuthorSearchResponse = {
  result: {
    hits: {
      "@total": string;
      hit?: DblpAuthorHit[] | DblpAuthorHit;
    };
  };
};

type DblpPublicationHit = {
  info: {
    type?: string;         // "Conference and Workshop Papers" | "Journal Articles" | ...
    title?: string;
    venue?: string;
    year?: string;
    url?: string;
  };
};

type DblpPublicationSearchResponse = {
  result: {
    hits: {
      "@total": string;
      hit?: DblpPublicationHit[] | DblpPublicationHit;
    };
  };
};

// ─── Normalize helpers ──────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function nameMatch(dblpName: string, queryName: string): boolean {
  const a = normalizeStr(dblpName);
  const q = normalizeStr(queryName);
  if (a === q) return true;

  // Handle numbered disambiguation (e.g., "Wei Wang 0042")
  const aClean = a.replace(/\s+\d{4}$/, "");
  if (aClean === q) return true;

  const aParts = aClean.split(" ");
  const qParts = q.split(" ");
  if (aParts.length >= 2 && qParts.length >= 2) {
    const aLast = aParts[aParts.length - 1];
    const qLast = qParts[qParts.length - 1];
    const aFirst = aParts[0];
    const qFirst = qParts[0];
    return aLast === qLast && (aFirst === qFirst || aFirst[0] === qFirst[0]);
  }
  return false;
}

// Well-known top-tier CS venues for bonus scoring
const TOP_CS_VENUES = new Set([
  "neurips", "nips", "icml", "iclr",       // ML
  "cvpr", "iccv", "eccv",                   // Vision
  "acl", "emnlp", "naacl",                  // NLP
  "aaai", "ijcai",                           // General AI
  "sigmod", "vldb", "icde",                 // Databases
  "sosp", "osdi", "eurosys",               // Systems
  "stoc", "focs", "soda",                   // Theory
  "chi", "uist",                             // HCI
  "ccs", "usenix security", "ndss", "ieee s&p",  // Security
  "kdd", "www", "wsdm", "sigir",           // Data mining / IR
  "pldi", "popl", "oopsla",                 // PL
  "isca", "micro", "asplos", "hpca",       // Architecture
  "mobicom", "sigcomm", "nsdi", "infocom", // Networking
]);

function isTopVenue(venue: string): boolean {
  const norm = venue.toLowerCase().replace(/[^a-z0-9& ]/g, "").trim();
  return TOP_CS_VENUES.has(norm) || [...TOP_CS_VENUES].some((v) => norm.includes(v));
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Find a researcher on DBLP by name, returning their publication
 * breakdown (conferences vs journals) and top venues.
 */
export async function findAuthor(input: {
  name: string;
  institution?: string;
}): Promise<DblpResult | null> {
  const r = getRedis();
  const key = cacheKey(JSON.stringify(input));

  // Check cache
  if (r) {
    try {
      const cached = await r.get<DblpResult | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[dblp] Cache hit for", input.name);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[dblp] Cache read failed:", e);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    // Step 1: Author search
    const searchUrl = `${AUTHOR_SEARCH_URL}?q=${encodeURIComponent(input.name)}&format=json&h=10`;
    const searchRes = await fetch(searchUrl, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (!searchRes.ok) {
      throw new Error(`DBLP HTTP ${searchRes.status}: ${searchRes.statusText}`);
    }

    const searchData = (await searchRes.json()) as DblpAuthorSearchResponse;
    const totalHits = parseInt(searchData.result.hits["@total"], 10);

    if (totalHits === 0 || !searchData.result.hits.hit) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    // Normalize hits to array
    const hits = Array.isArray(searchData.result.hits.hit)
      ? searchData.result.hits.hit
      : [searchData.result.hits.hit];

    // Find best matching author
    let bestAuthor: DblpAuthorHit | null = null;
    for (const hit of hits) {
      if (nameMatch(hit.info.author, input.name)) {
        bestAuthor = hit;
        break;
      }
    }

    if (!bestAuthor) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const authorUrl = bestAuthor.info.url ?? "";
    // Extract PID from URL: https://dblp.org/pid/123/4567 → 123/4567
    const pidMatch = authorUrl.match(/pid\/(.+)$/);
    const pid = pidMatch ? pidMatch[1] : "";

    // Step 2: Fetch publications for this author
    let conferences = 0;
    let journals = 0;
    let other = 0;
    let publicationCount = 0;
    const venues = new Map<string, number>();
    const topVenuesList: string[] = [];

    if (pid) {
      try {
        const pubUrl = `${PERSON_URL}/${pid}.xml`;
        const pubRes = await fetch(pubUrl, {
          headers: { "User-Agent": POLITE_USER_AGENT },
          signal: controller.signal,
        });

        if (pubRes.ok) {
          const xml = await pubRes.text();

          // Count publication types from XML
          // <inproceedings> = conference, <article> = journal
          const inprocMatches = xml.match(/<inproceedings /g);
          const articleMatches = xml.match(/<article /g);
          const otherMatches = xml.match(/<(?:incollection|phdthesis|mastersthesis|proceedings|book|data|informal) /g);

          conferences = inprocMatches?.length ?? 0;
          journals = articleMatches?.length ?? 0;
          other = otherMatches?.length ?? 0;
          publicationCount = conferences + journals + other;

          // Extract venue names from booktitle (conferences) and journal (journals)
          const booktitleMatches = xml.matchAll(/<booktitle>([^<]+)<\/booktitle>/g);
          for (const m of booktitleMatches) {
            const venue = m[1].trim();
            venues.set(venue, (venues.get(venue) ?? 0) + 1);
          }

          const journalMatches2 = xml.matchAll(/<journal>([^<]+)<\/journal>/g);
          for (const m of journalMatches2) {
            const venue = m[1].trim();
            venues.set(venue, (venues.get(venue) ?? 0) + 1);
          }

          // Identify top venues
          for (const [venue] of venues) {
            if (isTopVenue(venue) && !topVenuesList.includes(venue)) {
              topVenuesList.push(venue);
            }
          }
        }
      } catch (e) {
        logger.warn("[dblp] Publication fetch failed (non-fatal):", e);
      }
    }

    // Compute confidence
    let confidence = 0.4; // base name match

    // Has publications → +0.2
    if (publicationCount > 0) confidence += 0.2;

    // Has conference papers (CS-specific signal) → +0.1
    if (conferences > 0) confidence += 0.1;

    // Top venue presence → +0.1
    if (topVenuesList.length > 0) confidence += 0.1;

    // Institution check from DBLP notes (some authors have affiliation)
    if (input.institution && bestAuthor.info.notes?.note) {
      const notes = Array.isArray(bestAuthor.info.notes.note)
        ? bestAuthor.info.notes.note
        : [bestAuthor.info.notes.note];
      const normInst = normalizeStr(input.institution);
      const hasAffilMatch = notes.some((n) => {
        if (n["@type"] === "affiliation" && n.text) {
          return normalizeStr(n.text).includes(normInst) || normInst.includes(normalizeStr(n.text));
        }
        return false;
      });
      if (hasAffilMatch) confidence += 0.1;
    }

    confidence = Math.min(1.0, Math.round(confidence * 100) / 100);

    if (confidence < MIN_CONFIDENCE) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const result: DblpResult = {
      authorName: bestAuthor.info.author,
      authorUrl: authorUrl || `https://dblp.org/search/author?q=${encodeURIComponent(input.name)}`,
      publicationCount,
      venueBreakdown: { conferences, journals, other },
      topVenues: topVenuesList.slice(0, 10),
      sourceUrl: authorUrl || `https://dblp.org/search/author?q=${encodeURIComponent(input.name)}`,
      confidence,
    };

    if (r) { try { await r.set(key, result, { ex: CACHE_TTL_SECONDS }); } catch {} }

    return result;
  } catch (e) {
    logger.error("[dblp] findAuthor failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
