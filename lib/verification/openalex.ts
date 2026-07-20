/**
 * OpenAlex public-API client for author verification.
 *
 * Finds researchers by name + institution + field and returns publication
 * metrics with a rules-based confidence score. Uses the polite pool
 * (mailto param) and caches responses for 24h via Upstash Redis.
 *
 * Docs: https://docs.openalex.org/api-entities/authors
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT, POLITE_MAILTO } from "./types";
import type { OpenAlexAuthor, OpenAlexWork } from "./types";
import { nameMatchStrength, foldName } from "./nameMatch";

// ─── Constants ──────────────────────────────────────────────────────

const BASE_URL = "https://api.openalex.org";
const MAILTO = POLITE_MAILTO;
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

function cacheKey(prefix: string, input: string): string {
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `openalex:${prefix}:${hash}`;
}

// ─── HTTP helper ────────────────────────────────────────────────────

async function oaFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, BASE_URL);
  url.searchParams.set("mailto", MAILTO);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (res.status === 429) {
      logger.warn("[openalex] Rate-limited (429)");
      throw new Error("OpenAlex rate limit hit");
    }

    if (!res.ok) {
      throw new Error(`OpenAlex HTTP ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── OpenAlex API response types (internal) ─────────────────────────

type OAAuthorResult = {
  id: string;
  display_name: string;
  works_count: number;
  cited_by_count: number;
  summary_stats?: { h_index?: number };
  last_known_institutions?: Array<{
    id?: string;
    display_name?: string;
    ror?: string;
    type?: string;
  }>;
  affiliations?: Array<{
    institution?: {
      id?: string;
      display_name?: string;
      ror?: string;
    };
    years?: number[];
  }>;
  topics?: Array<{
    id: string;
    display_name: string;
    subfield?: { display_name?: string };
    field?: { display_name?: string };
    domain?: { display_name?: string };
  }>;
  works_api_url?: string;
};

type OASearchResponse = {
  results: OAAuthorResult[];
  meta: { count: number };
};

type OAWorkResult = {
  id: string;
  title?: string;
  display_name?: string;
  doi?: string;
  publication_year: number;
  cited_by_count: number;
};

type OAWorksResponse = {
  results: OAWorkResult[];
  meta: { count: number };
};

// ─── Confidence scoring ─────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function extractAffiliationRorIds(author: OAAuthorResult): string[] {
  const rorIds = new Set<string>();
  for (const inst of author.last_known_institutions ?? []) {
    if (inst.ror) rorIds.add(inst.ror);
  }
  for (const aff of author.affiliations ?? []) {
    if (aff.institution?.ror) rorIds.add(aff.institution.ror);
  }
  return [...rorIds];
}

function acronymOf(fullName: string): string {
  return fullName.split(/\s+/)
    .filter((w) => w.length > 1 && w[0] === w[0].toUpperCase())
    .map((w) => w[0].toLowerCase())
    .join("");
}

function institutionMatch(
  author: OAAuthorResult,
  queryInstitution: string,
): boolean {
  const norm = normalizeStr(queryInstitution);
  const institutions = [
    ...(author.last_known_institutions ?? []),
    ...(author.affiliations ?? []).map((a) => a.institution).filter(Boolean),
  ];
  return institutions.some((inst) => {
    const name = normalizeStr(inst?.display_name ?? "");
    const acronym = acronymOf(inst?.display_name ?? "");
    // Substring match (e.g., "stanford" in "stanford university")
    if (name.includes(norm) || norm.includes(name)) return true;
    // Acronym match (e.g., "nyu" → "New York University")
    if (norm === acronym) return true;
    // Query is the acronym of the full name
    if (acronymOf(queryInstitution) === acronym && acronym.length >= 2) return true;
    return false;
  });
}

function fieldMatch(
  author: OAAuthorResult,
  queryField: string,
): boolean {
  const norm = normalizeStr(queryField);
  return (author.topics ?? []).some((t) => {
    const names = [
      t.display_name,
      t.subfield?.display_name,
      t.field?.display_name,
      t.domain?.display_name,
    ].filter(Boolean).map((n) => normalizeStr(n!));
    return names.some((n) => n.includes(norm) || norm.includes(n));
  });
}

/**
 * Score a candidate. Name is the PRIMARY signal — institution and field are
 * corroborating bonuses, never gates. This is deliberate: OpenAlex's
 * institution metadata is frequently wrong or missing (it had no institution
 * for a real, well-indexed CS researcher), so gating on it rejected genuine
 * matches. A strong name match alone clears MIN_CONFIDENCE; institution/field
 * add headroom that helps disambiguate common names.
 */
function scoreAuthor(
  author: OAAuthorResult,
  input: { name: string; institution?: string; field?: string },
): { confidence: number; matchSignals: string[] } {
  const signals: string[] = [];

  // Name is the spine of the match. Order/diacritic/initial-tolerant.
  const nameStrength = nameMatchStrength(author.display_name, input.name);
  if (nameStrength === 0) {
    return { confidence: 0, matchSignals: signals };
  }
  // Map name strength → up to 0.6 (exact set match = 0.6 = threshold).
  let confidence = nameStrength * 0.6;
  signals.push(nameStrength >= 1 ? "name_exact" : "name_partial");

  // Institution match: +0.25 (corroboration, not a requirement)
  if (input.institution && institutionMatch(author, input.institution)) {
    confidence += 0.25;
    signals.push("institution_match");
  }

  // Field/topic overlap: +0.15
  if (input.field && fieldMatch(author, input.field)) {
    confidence += 0.15;
    signals.push("field_match");
  }

  // Active researcher (has indexed works): small +0.05 nudge.
  if (author.works_count > 0) {
    confidence += 0.05;
    signals.push("has_works");
  }

  return { confidence: Math.round(Math.min(confidence, 1) * 100) / 100, matchSignals: signals };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Find an author by name + optional institution + optional field.
 *
 * Disambiguation strategy (3 layers):
 *  1. Deterministic: if `orcid` is provided, fetch via /authors/orcid:{id}
 *     → confidence 1.0, matchQuality "deterministic", zero ambiguity.
 *  2. Fuzzy with claimed-count guard: name-based search scored by
 *     institution + field + recency. If `claimedPublicationCount` is given
 *     and the best match's works_count > claimed * 3, confidence is halved
 *     and matchQuality set to "ambiguous" (likely wrong person).
 *  3. Ambiguity detection: when top-2 candidates have a confidence spread
 *     < 0.15, matchQuality is set to "ambiguous" — the engine can't
 *     reliably distinguish them.
 */
export async function findAuthor(input: {
  name: string;
  institution?: string;
  field?: string;
  orcid?: string;
  claimedPublicationCount?: number;
}): Promise<OpenAlexAuthor | null> {
  const r = getRedis();
  const key = cacheKey("author", JSON.stringify(input));

  // Check cache
  if (r) {
    try {
      const cached = await r.get<OpenAlexAuthor | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[openalex] Cache hit for", input.name);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[openalex] Cache read failed:", e);
    }
  }

  try {
    // ── Layer 1: Deterministic ORCID → OpenAlex lookup ──────────────
    if (input.orcid) {
      const orcidClean = input.orcid
        .trim()
        .replace(/^https?:\/\/orcid\.org\//i, "");

      try {
        const author = await oaFetch<OAAuthorResult>(
          `/authors/orcid:${orcidClean}`,
        );

        if (author?.id) {
          const authorId = author.id.replace("https://openalex.org/", "");
          const result: OpenAlexAuthor = {
            id: authorId,
            displayName: author.display_name,
            institution: author.last_known_institutions?.[0]?.display_name,
            worksCount: author.works_count,
            citedByCount: author.cited_by_count,
            hIndex: author.summary_stats?.h_index ?? 0,
            sourceUrl: `https://openalex.org/${authorId}`,
            confidence: 1.0,
            matchSignals: ["orcid_deterministic"],
            matchQuality: "deterministic",
            affiliationRorIds: extractAffiliationRorIds(author),
            topField: author.topics?.[0]?.field?.display_name,
          };

          if (r) {
            try { await r.set(key, result, { ex: CACHE_TTL_SECONDS }); } catch {}
          }

          logger.info(
            `[openalex] Deterministic ORCID match for "${input.name}": ${authorId}`,
          );
          return result;
        }
      } catch (e) {
        // ORCID not found in OpenAlex — fall through to fuzzy search
        logger.warn(
          `[openalex] ORCID lookup for ${orcidClean} failed, falling back to fuzzy search`,
          e,
        );
      }
    }

    // ── Layer 2+3: Fuzzy search with disambiguation guards ──────────
    const data = await oaFetch<OASearchResponse>("/authors", {
      search: input.name,
      per_page: "10",
    });

    if (data.results.length === 0) {
      if (r) {
        try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {}
      }
      return null;
    }

    // Score each candidate, filter above threshold, sort desc
    const scored = data.results
      .map((candidate) => ({
        author: candidate,
        ...scoreAuthor(candidate, input),
      }))
      .filter((c) => c.confidence >= MIN_CONFIDENCE)
      .sort((a, b) => b.confidence - a.confidence);

    if (scored.length === 0) {
      if (r) {
        try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {}
      }
      return null;
    }

    // Layer 1.5: same-person fragmentation merge. OpenAlex routinely splits ONE
    // researcher across several author IDs — e.g. "Achouak Benarbia" (1 work) +
    // "Achouak Benarbia" (2 works) + "A. Benarbia" (9 works, 21 cit), ALL at the
    // University of North Dakota. Picking the highest-confidence fragment yields
    // a tiny record and a false "ambiguous" (two fragments tie on confidence).
    // When ≥2 candidates share the applicant's OWN institution AND the same
    // surname, they are the same person: anchor on the most COMPLETE fragment
    // (max works) and treat it as a confident, unique match.
    const surnameOf = (n: string) => foldName(n).split(" ").filter(Boolean).pop() ?? "";
    let fragmentMerged = false;
    if (input.institution) {
      const topSurname = surnameOf(scored[0].author.display_name);
      const cluster = scored.filter(
        (c) => c.matchSignals.includes("institution_match") && surnameOf(c.author.display_name) === topSurname,
      );
      if (cluster.length >= 2) {
        const canonical = cluster.reduce((a, b) => (b.author.works_count > a.author.works_count ? b : a));
        canonical.confidence = Math.max(...cluster.map((c) => c.confidence));
        if (scored.indexOf(canonical) !== 0) {
          scored.splice(scored.indexOf(canonical), 1);
          scored.unshift(canonical);
        }
        fragmentMerged = true;
        logger.info(
          `[openalex] Merged ${cluster.length} same-institution fragments for "${input.name}" → ` +
          `anchored on the ${canonical.author.works_count}-work / ${canonical.author.cited_by_count}-cit record`,
        );
      }
    }

    // Layer 2 (pre-rank): when the applicant gave a publication count and the
    // most-cited name match dwarfs it, the top hit is almost certainly a more
    // prolific NAMESAKE (the IEEE-Fellow "Saifur Rahman" surfacing above the
    // grad student). Prefer a lower-ranked candidate whose record SCALE fits the
    // self-report AND that corroborates on institution or field — the real
    // applicant — before falling back to flagging the giant ambiguous.
    let best = scored[0];
    let rerankedToFit = false;
    const claim = input.claimedPublicationCount;
    if (!fragmentMerged && claim !== undefined && claim > 0 && best.author.works_count > claim * 3) {
      const fit = scored.find(
        (c) =>
          c.author.works_count <= Math.max(claim * 4, 10) &&
          (c.matchSignals.includes("institution_match") || c.matchSignals.includes("field_match")),
      );
      if (fit && fit !== best) {
        logger.info(
          `[openalex] Re-ranked "${input.name}" to scale/institution-fit candidate ` +
          `(${fit.author.works_count} works) over top namesake (${best.author.works_count} works)`,
        );
        best = fit;
        rerankedToFit = true;
      }
    }

    let confidence = best.confidence;
    let matchQuality: OpenAlexAuthor["matchQuality"] = "fuzzy";
    const signals = [...best.matchSignals];

    // A merged same-institution cluster, or a re-ranked candidate that matches
    // the applicant's OWN institution, is a confident unique resolution — never
    // flag it ambiguous.
    const confidentFit = fragmentMerged || (rerankedToFit && best.matchSignals.includes("institution_match"));

    if (!confidentFit) {
      // Layer 3: Ambiguity detection — top-2 spread < 0.15
      if (scored.length >= 2) {
        const spread = scored[0].confidence - scored[1].confidence;
        if (spread < 0.15) {
          matchQuality = "ambiguous";
          signals.push("ambiguous_top2");
          logger.warn(
            `[openalex] Ambiguous match for "${input.name}": ` +
            `"${scored[0].author.display_name}" (${scored[0].confidence}) vs ` +
            `"${scored[1].author.display_name}" (${scored[1].confidence}), ` +
            `spread=${spread.toFixed(3)}`,
          );
        }
      }

      // Layer 2 (fallback): the top match dwarfs the claim and no fitting
      // candidate was found → the record is a probable namesake.
      if (
        !rerankedToFit &&
        claim !== undefined &&
        claim > 0 &&
        best.author.works_count > claim * 3
      ) {
        const before = confidence;
        confidence = Math.round(confidence * 0.5 * 100) / 100;
        matchQuality = "ambiguous";
        signals.push("claimed_count_mismatch");
        logger.warn(
          `[openalex] Claimed-count guard for "${input.name}": ` +
          `claimed ~${claim}, found ${best.author.works_count} → ` +
          `confidence ${before} → ${confidence}`,
        );
      }
    }

    const { author } = best;
    const authorId = author.id.replace("https://openalex.org/", "");

    const result: OpenAlexAuthor = {
      id: authorId,
      displayName: author.display_name,
      institution: author.last_known_institutions?.[0]?.display_name,
      worksCount: author.works_count,
      citedByCount: author.cited_by_count,
      hIndex: author.summary_stats?.h_index ?? 0,
      sourceUrl: `https://openalex.org/${authorId}`,
      confidence,
      matchSignals: signals,
      matchQuality,
      affiliationRorIds: extractAffiliationRorIds(best.author),
      topField: best.author.topics?.[0]?.field?.display_name,
    };

    // Cache the result
    if (r) {
      try { await r.set(key, result, { ex: CACHE_TTL_SECONDS }); } catch {}
    }

    return result;
  } catch (e) {
    logger.error("[openalex] findAuthor failed:", e);
    return null;
  }
}

/**
 * Get an author's works (publications) by their OpenAlex author ID.
 */
export async function getAuthorWorks(
  authorId: string,
  limit: number = 10,
): Promise<OpenAlexWork[]> {
  const r = getRedis();
  const key = cacheKey("works", `${authorId}:${limit}`);

  // Check cache
  if (r) {
    try {
      const cached = await r.get<OpenAlexWork[]>(key);
      if (cached) return cached;
    } catch {}
  }

  try {
    const fullId = authorId.startsWith("A") ? `https://openalex.org/${authorId}` : authorId;
    const data = await oaFetch<OAWorksResponse>("/works", {
      filter: `authorships.author.id:${fullId}`,
      sort: "cited_by_count:desc",
      per_page: String(limit),
      select: "id,title,display_name,doi,publication_year,cited_by_count",
    });

    const works: OpenAlexWork[] = data.results.map((w) => ({
      id: w.id.replace("https://openalex.org/", ""),
      title: w.display_name ?? w.title ?? "Untitled",
      doi: w.doi?.replace("https://doi.org/", ""),
      publicationYear: w.publication_year,
      citedByCount: w.cited_by_count,
      sourceUrl: w.id,
    }));

    // Cache
    if (r) {
      try { await r.set(key, works, { ex: CACHE_TTL_SECONDS }); } catch {}
    }

    return works;
  } catch (e) {
    logger.error("[openalex] getAuthorWorks failed:", e);
    return [];
  }
}
