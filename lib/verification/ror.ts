/**
 * ROR (Research Organization Registry) client for institution verification.
 *
 * Confirms a claimed institution exists and is a real research organization.
 * Used to validate "I have a PhD from <institution>" without needing a
 * degree-verification vendor.
 *
 * Docs: https://ror.readme.io/docs/api-v2
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { RorOrg } from "./types";

// ─── Constants ──────────────────────────────────────────────────────

const BASE_URL = "https://api.ror.org/v2/organizations";
const CACHE_TTL_SECONDS = 86_400; // 24 hours
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_CONFIDENCE = 0.7;

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
  return `ror:org:${hash}`;
}

// ─── Normalize ──────────────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ─── ROR API response types (internal) ──────────────────────────────

type RorResult = {
  id: string;
  names: Array<{
    value: string;
    types: string[];
    lang?: string | null;
  }>;
  locations: Array<{
    geonames_details: {
      country_name?: string;
      country_code?: string;
    };
  }>;
  types: string[];
  links: Array<{ type: string; value: string }>;
  admin?: { created?: { date?: string } };
};

type RorSearchResponse = {
  number_of_results: number;
  items: RorResult[];
};

// ─── Confidence scoring ─────────────────────────────────────────────

function scoreResult(result: RorResult, query: string): number {
  const normQuery = normalizeStr(query);
  let confidence = 0;

  // Check all names (ror_display, label, alias, acronym)
  const allNames = result.names.map((n) => normalizeStr(n.value));
  const allAcronyms = result.names
    .filter((n) => n.types.includes("acronym"))
    .map((n) => normalizeStr(n.value));

  // Exact match on any name
  if (allNames.some((n) => n === normQuery)) {
    confidence = 1.0;
  }
  // Acronym match
  else if (allAcronyms.some((a) => a === normQuery)) {
    confidence = 0.95;
  }
  // Substring match (query is part of name or vice versa)
  else if (allNames.some((n) => n.includes(normQuery) || normQuery.includes(n))) {
    confidence = 0.85;
  }
  // Fuzzy: query words appear in name
  else {
    const queryWords = normQuery.split(" ").filter((w) => w.length > 2);
    const nameStr = allNames.join(" ");
    const matchedWords = queryWords.filter((w) => nameStr.includes(w));
    confidence = matchedWords.length / queryWords.length * 0.8;
  }

  return Math.round(confidence * 100) / 100;
}

// ─── Result → RorOrg mapper ─────────────────────────────────────────

function toRorOrg(result: RorResult, confidence: number): RorOrg {
  const displayName =
    result.names.find((n) => n.types.includes("ror_display"))?.value ??
    result.names[0]?.value ??
    "";
  const acronyms = result.names
    .filter((n) => n.types.includes("acronym"))
    .map((n) => n.value);
  const country = result.locations?.[0]?.geonames_details?.country_name ?? "Unknown";
  return {
    id: result.id,
    name: displayName,
    acronyms,
    country,
    types: result.types,
    sourceUrl: result.id, // ROR ID is also the URL
    confidence,
  };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Lightweight result for the intake typeahead. The user picks one of these,
 * and we persist its `id` (ROR ID) so verification can resolve the exact
 * org later — no fuzzy guessing at verify time.
 */
export type RorSearchHit = {
  id: string;
  name: string;
  acronym?: string;
  country: string;
  type: string;
};

/**
 * Search ROR for institutions matching a free-text query, returning the top
 * N canonical hits for an autocomplete. Unlike findInstitution (which picks a
 * single best match for verification), this returns the candidate list the
 * user chooses from.
 */
export async function searchInstitutions(query: string, limit = 8): Promise<RorSearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const r = getRedis();
  const key = `ror:search:${createHash("sha256").update(`${limit}:${q.toLowerCase()}`).digest("hex").slice(0, 16)}`;
  if (r) {
    try {
      const cached = await r.get<RorSearchHit[]>(key);
      if (cached) return cached;
    } catch (e) {
      logger.warn("[ror] search cache read failed:", e);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}?query=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`ROR HTTP ${res.status}: ${res.statusText}`);
    const data = (await res.json()) as RorSearchResponse;

    const hits: RorSearchHit[] = data.items.slice(0, limit).map((item) => {
      const org = toRorOrg(item, 1);
      return {
        id: org.id,
        name: org.name,
        acronym: org.acronyms[0],
        country: org.country,
        type: org.types[0] ?? "",
      };
    });

    if (r) { try { await r.set(key, hits, { ex: CACHE_TTL_SECONDS }); } catch {} }
    return hits;
  } catch (e) {
    logger.error("[ror] searchInstitutions failed:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve a single organization by its ROR ID. Used at verification time when
 * the applicant picked an institution from the typeahead — we trust the exact
 * ID (confidence 1.0) instead of re-running a fuzzy name search, which is what
 * once mismatched "New York University" to "NYU Florence, Italy".
 */
export async function getInstitutionById(rorId: string): Promise<RorOrg | null> {
  const id = rorId.trim();
  if (!id) return null;
  // ROR IDs are URLs (https://ror.org/<suffix>); the API accepts the suffix.
  const suffix = id.split("/").filter(Boolean).pop() ?? id;

  const r = getRedis();
  const key = `ror:id:${suffix}`;
  if (r) {
    try {
      const cached = await r.get<RorOrg | "null">(key);
      if (cached !== null && cached !== undefined) return cached === "null" ? null : cached;
    } catch (e) {
      logger.warn("[ror] id cache read failed:", e);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/${encodeURIComponent(suffix)}`, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });
    if (res.status === 404) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }
    if (!res.ok) throw new Error(`ROR HTTP ${res.status}: ${res.statusText}`);
    const result = (await res.json()) as RorResult;
    const org = toRorOrg(result, 1);
    if (r) { try { await r.set(key, org, { ex: CACHE_TTL_SECONDS }); } catch {} }
    return org;
  } catch (e) {
    logger.error("[ror] getInstitutionById failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Find a research organization by name query.
 * Tolerates misspellings via ROR's built-in fuzzy matching.
 */
export async function findInstitution(query: string): Promise<RorOrg | null> {
  const r = getRedis();
  const key = cacheKey(query);

  // Check cache
  if (r) {
    try {
      const cached = await r.get<RorOrg | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[ror] Cache hit for", query);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[ror] Cache read failed:", e);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${BASE_URL}?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`ROR HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as RorSearchResponse;

    if (data.number_of_results === 0 || data.items.length === 0) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    // Score and pick best match
    let bestMatch: { result: RorResult; confidence: number } | null = null;

    for (const item of data.items.slice(0, 10)) {
      const confidence = scoreResult(item, query);
      if (confidence >= MIN_CONFIDENCE && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { result: item, confidence };
      }
    }

    if (!bestMatch) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const { result, confidence } = bestMatch;

    // Extract canonical name (prefer ror_display type)
    const displayName = result.names.find((n) => n.types.includes("ror_display"))?.value
      ?? result.names[0]?.value
      ?? query;

    const acronyms = result.names
      .filter((n) => n.types.includes("acronym"))
      .map((n) => n.value);

    const country = result.locations?.[0]?.geonames_details?.country_name ?? "Unknown";

    const org: RorOrg = {
      id: result.id,
      name: displayName,
      acronyms,
      country,
      types: result.types,
      sourceUrl: result.id, // ROR ID is also the URL
      confidence,
    };

    if (r) { try { await r.set(key, org, { ex: CACHE_TTL_SECONDS }); } catch {} }

    return org;
  } catch (e) {
    logger.error("[ror] findInstitution failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
