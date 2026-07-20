/**
 * ORCID public-API client for researcher verification.
 *
 * Looks up researchers by name + institution + optional email via the
 * ORCID expanded-search endpoint. Returns profile with publication count
 * and confidence score.
 *
 * Docs: https://info.orcid.org/documentation/api-tutorials/api-tutorial-searching-the-orcid-registry/
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { OrcidProfile } from "./types";

// ─── Constants ──────────────────────────────────────────────────────

const BASE_URL = "https://pub.orcid.org/v3.0";
const CACHE_TTL_SECONDS = 86_400; // 24 hours
const REQUEST_TIMEOUT_MS = 8_000;
const MIN_CONFIDENCE = 0.4;

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
  return `orcid:profile:${hash}`;
}

// ─── Normalize helpers ──────────────────────────────────────────────

function normalizeStr(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ─── ORCID record types (for by-iD fetch) ───────────────────────────

type OrcidNameValue = { value: string };

type OrcidExternalId = {
  "external-id-type": string;
  "external-id-value": string;
};

type OrcidWorkSummary = {
  "external-ids"?: { "external-id"?: OrcidExternalId[] };
};

type OrcidWorkGroup = {
  "work-summary"?: OrcidWorkSummary[];
};

type OrcidRecord = {
  person?: {
    name?: {
      "given-names"?: OrcidNameValue;
      "family-name"?: OrcidNameValue;
    };
  };
  "activities-summary"?: {
    works?: { group?: OrcidWorkGroup[] };
    employments?: {
      "affiliation-group"?: Array<{
        summaries?: Array<{
          "employment-summary"?: { organization?: { name?: string } };
        }>;
      }>;
    };
  };
};

// ─── ORCID API response types (internal) ────────────────────────────

type OrcidExpandedResult = {
  "orcid-id": string;
  "given-names"?: string;
  "family-names"?: string;
  "credit-name"?: string;
  "institution-name"?: string[];
  "email"?: string[];
  "other-name"?: string[];
};

type OrcidSearchResponse = {
  "expanded-result"?: OrcidExpandedResult[];
  "num-found"?: number;
};

// ─── Confidence scoring ─────────────────────────────────────────────

function scoreResult(
  result: OrcidExpandedResult,
  input: { name: string; institution?: string; email?: string },
): { confidence: number; matchSignals: string[] } {
  let confidence = 0;
  const signals: string[] = [];

  // Name match: +0.3 (boosted — most researchers lack public emails on ORCID,
  // so name+institution must be enough to clear the 0.4 threshold)
  const givenNames = normalizeStr(result["given-names"] ?? "");
  const familyNames = normalizeStr(result["family-names"] ?? "");
  const creditName = normalizeStr(result["credit-name"] ?? "");
  const queryName = normalizeStr(input.name);
  const fullApiName = `${givenNames} ${familyNames}`.trim();

  if (fullApiName === queryName || creditName === queryName) {
    confidence += 0.3;
    signals.push("name_exact");
  } else if (fullApiName.includes(queryName) || queryName.includes(fullApiName)) {
    confidence += 0.2;
    signals.push("name_partial");
  }

  // Email match: +0.5
  if (input.email) {
    const normEmail = input.email.toLowerCase();
    const emails = (result["email"] ?? []).map((e) => e.toLowerCase());
    if (emails.includes(normEmail)) {
      confidence += 0.5;
      signals.push("email_match");
    }
  }

  // Institution affiliation match: +0.3
  if (input.institution) {
    const normInst = normalizeStr(input.institution);
    const institutions = (result["institution-name"] ?? []).map(normalizeStr);
    const matched = institutions.some(
      (inst) => inst.includes(normInst) || normInst.includes(inst),
    );
    if (matched) {
      confidence += 0.3;
      signals.push("institution_match");
    }
  }

  return { confidence: Math.round(confidence * 100) / 100, matchSignals: signals };
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Find a researcher on ORCID by name + optional institution + optional email.
 * Returns the best match above the confidence threshold, or null.
 */
export async function findOrcid(input: {
  name: string;
  institution?: string;
  email?: string;
}): Promise<OrcidProfile | null> {
  const r = getRedis();
  const key = cacheKey(JSON.stringify(input));

  // Check cache
  if (r) {
    try {
      const cached = await r.get<OrcidProfile | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[orcid] Cache hit for", input.name);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[orcid] Cache read failed:", e);
    }
  }

  // Build Lucene-style search query
  const nameParts = input.name.split(/\s+/);
  const queryParts: string[] = [];

  if (nameParts.length >= 2) {
    const given = nameParts.slice(0, -1).join(" ");
    const family = nameParts[nameParts.length - 1];
    queryParts.push(`given-names:${given} AND family-name:${family}`);
  } else {
    queryParts.push(`family-name:${input.name}`);
  }

  if (input.email) {
    queryParts.push(`email:${input.email}`);
  }

  if (input.institution) {
    queryParts.push(`affiliation-org-name:${input.institution}`);
  }

  const query = queryParts.join(" AND ");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${BASE_URL}/expanded-search/?q=${encodeURIComponent(query)}&rows=10`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`ORCID HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as OrcidSearchResponse;
    const results = data["expanded-result"] ?? [];

    if (results.length === 0) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    // Score each candidate, pick the best above threshold
    let bestMatch: { result: OrcidExpandedResult; confidence: number; signals: string[] } | null = null;

    for (const candidate of results) {
      const { confidence, matchSignals } = scoreResult(candidate, input);
      if (confidence >= MIN_CONFIDENCE && (!bestMatch || confidence > bestMatch.confidence)) {
        bestMatch = { result: candidate, confidence, signals: matchSignals };
      }
    }

    if (!bestMatch) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    const { result, confidence } = bestMatch;
    const orcidId = result["orcid-id"];

    // Fetch the full record to get publication count
    let publicationCount = 0;
    try {
      const recordRes = await fetch(`${BASE_URL}/${orcidId}/works`, {
        headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
        signal: controller.signal,
      });
      if (recordRes.ok) {
        const recordData = (await recordRes.json()) as { group?: unknown[] };
        publicationCount = recordData.group?.length ?? 0;
      }
    } catch {
      // Non-fatal — we still have the profile
    }

    const profile: OrcidProfile = {
      orcidId,
      displayName: result["credit-name"]
        ?? `${result["given-names"] ?? ""} ${result["family-names"] ?? ""}`.trim(),
      currentAffiliation: result["institution-name"]?.[0],
      publicationCount,
      sourceUrl: `https://orcid.org/${orcidId}`,
      confidence,
    };

    if (r) { try { await r.set(key, profile, { ex: CACHE_TTL_SECONDS }); } catch {} }

    return profile;
  } catch (e) {
    logger.error("[orcid] findOrcid failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch an ORCID record directly by iD (not by name search).
 *
 * When the applicant provides their ORCID iD we should use it — fetching by iD
 * is deterministic and bypasses the name-collision problem that makes thin-profile
 * researchers (few pubs in OpenAlex) score low. A name guard confirms the record
 * belongs to the person who submitted the iD. Returns OrcidProfile with
 * fetchedById=true and dois[] from their works list.
 */
export async function fetchOrcidById(
  orcidId: string,
  nameGuard: string,
): Promise<OrcidProfile | null> {
  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(orcidId)) {
    logger.warn("[orcid] fetchOrcidById: invalid iD format:", orcidId);
    return null;
  }

  const r = getRedis();
  const key = `orcid:byid:${orcidId}`;

  if (r) {
    try {
      const cached = await r.get<OrcidProfile | "null">(key);
      if (cached !== null && cached !== undefined) {
        logger.info("[orcid] Cache hit (byId) for", orcidId);
        return cached === "null" ? null : cached;
      }
    } catch (e) {
      logger.warn("[orcid] Cache read (byId) failed:", e);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE_URL}/${orcidId}/record`, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) {
      if (res.status === 404) {
        if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
        return null;
      }
      throw new Error(`ORCID HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as OrcidRecord;

    // Name guard: the family name must appear in both the record and the self-report.
    const givenFromRecord = normalizeStr(data.person?.name?.["given-names"]?.value ?? "");
    const familyFromRecord = normalizeStr(data.person?.name?.["family-name"]?.value ?? "");
    const guardParts = normalizeStr(nameGuard).split(" ").filter(Boolean);
    const lastGuardPart = guardParts[guardParts.length - 1] ?? "";

    if (
      !familyFromRecord ||
      (!familyFromRecord.includes(lastGuardPart) && !lastGuardPart.includes(familyFromRecord))
    ) {
      logger.info(
        `[orcid] fetchOrcidById: name guard rejected. Record family="${familyFromRecord}", guard last="${lastGuardPart}"`,
      );
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL_SECONDS }); } catch {} }
      return null;
    }

    // Extract DOIs from works (max 20 to keep Crossref calls manageable).
    const groups = data["activities-summary"]?.works?.group ?? [];
    const dois: string[] = [];
    for (const group of groups) {
      const summary = group["work-summary"]?.[0];
      if (!summary) continue;
      for (const extId of summary["external-ids"]?.["external-id"] ?? []) {
        if (extId["external-id-type"] === "doi" && extId["external-id-value"]) {
          dois.push(extId["external-id-value"]);
          if (dois.length >= 20) break;
        }
      }
      if (dois.length >= 20) break;
    }

    const affiliation =
      data["activities-summary"]?.employments?.["affiliation-group"]?.[0]
        ?.summaries?.[0]?.["employment-summary"]?.organization?.name;

    const profile: OrcidProfile = {
      orcidId,
      displayName:
        `${data.person?.name?.["given-names"]?.value ?? ""} ${data.person?.name?.["family-name"]?.value ?? ""}`.trim(),
      currentAffiliation: affiliation,
      publicationCount: groups.length,
      sourceUrl: `https://orcid.org/${orcidId}`,
      confidence: 0.95,
      fetchedById: true,
      dois,
    };

    if (r) { try { await r.set(key, profile, { ex: CACHE_TTL_SECONDS }); } catch {} }
    return profile;
  } catch (e) {
    logger.error("[orcid] fetchOrcidById failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
