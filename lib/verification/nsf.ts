/**
 * NSF Award Search API client.
 * Docs: https://www.research.gov/common/webapi/awardapisearchv2.htm
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { Grant } from "./types";

const BASE_URL = "https://api.nsf.gov/services/v1/awards.json";
const CACHE_TTL = 86_400;
const TIMEOUT = 5_000;

let redis: Redis | null = null;
function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

type NSFAwardResponse = {
  response: {
    award: Array<{
      id: string;
      title: string;
      piFirstName?: string;
      piLastName?: string;
      startDate?: string;
      expDate?: string;
      estimatedTotalAmt?: string;
    }>;
  };
};

/**
 * Find NSF grants by PI name, optionally filtered by awardee institution.
 *
 * When `institution` is provided the API `awardeeName` param narrows
 * results so common names don't pull in unrelated awards.
 */
export async function findGrants(
  piName: string,
  institution?: string,
): Promise<Grant[]> {
  const cacheInput = institution ? `${piName}|${institution}` : piName;
  const r = getRedis();
  const key = `nsf:grants:${createHash("sha256").update(cacheInput).digest("hex").slice(0, 16)}`;

  if (r) {
    try {
      const cached = await r.get<Grant[]>(key);
      if (cached) return cached;
    } catch {}
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const instParam = institution ? `&awardeeName=${encodeURIComponent(institution)}` : "";
    const url = `${BASE_URL}?pdPIName=${encodeURIComponent(piName)}${instParam}&printFields=id,title,piFirstName,piLastName,startDate,expDate,estimatedTotalAmt`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`NSF HTTP ${res.status}`);

    const data = (await res.json()) as NSFAwardResponse;
    const awards = data.response?.award ?? [];

    const grants: Grant[] = awards.slice(0, 20).map((a) => ({
      id: a.id,
      title: a.title,
      piName: `${a.piFirstName ?? ""} ${a.piLastName ?? ""}`.trim(),
      agency: "nsf" as const,
      startDate: a.startDate,
      endDate: a.expDate,
      amount: a.estimatedTotalAmt ? parseInt(a.estimatedTotalAmt, 10) : undefined,
      sourceUrl: `https://www.nsf.gov/awardsearch/showAward?AWD_ID=${a.id}`,
      confidence: 0.85, // NSF search is PI-name exact match
    }));

    if (r) { try { await r.set(key, grants, { ex: CACHE_TTL }); } catch {} }
    return grants;
  } catch (e) {
    logger.error("[nsf] findGrants failed:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
