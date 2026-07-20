/**
 * USPTO PatentsView API client for patent verification.
 * Docs: https://patentsview.org/apis/api-endpoints/patents
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { Patent } from "./types";

const BASE_URL = "https://api.patentsview.org/patents/query";
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

type PatentsViewResponse = {
  patents?: Array<{
    patent_number?: string;
    patent_title?: string;
    patent_date?: string;
    inventors?: Array<{
      inventor_first_name?: string;
      inventor_last_name?: string;
    }>;
  }>;
  count?: number;
  total_patent_count?: number;
};

/**
 * Find patents by inventor name.
 */
export async function findPatents(inventorName: string): Promise<Patent[]> {
  const r = getRedis();
  const key = `uspto:patents:${createHash("sha256").update(inventorName).digest("hex").slice(0, 16)}`;

  if (r) {
    try {
      const cached = await r.get<Patent[]>(key);
      if (cached) return cached;
    } catch {}
  }

  // Split name into first/last
  const parts = inventorName.trim().split(/\s+/);
  const firstName = parts.slice(0, -1).join(" ");
  const lastName = parts[parts.length - 1];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const query = {
      q: {
        _and: [
          { inventor_last_name: lastName },
          ...(firstName ? [{ inventor_first_name: firstName }] : []),
        ],
      },
      f: ["patent_number", "patent_title", "patent_date", "inventor_first_name", "inventor_last_name"],
      o: { per_page: 20 },
    };

    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
      body: JSON.stringify(query),
      redirect: "manual",
    });

    // PatentsView API was deprecated; detect redirect or non-JSON response
    if (res.status >= 300 && res.status < 400) {
      logger.warn("[uspto] PatentsView API redirected (deprecated endpoint)");
      return [];
    }

    if (!res.ok) throw new Error(`USPTO HTTP ${res.status}`);

    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      logger.warn(`[uspto] PatentsView returned non-JSON (${ct}). API may be deprecated.`);
      return [];
    }

    const data = (await res.json()) as PatentsViewResponse;
    const results = data.patents ?? [];

    const patents: Patent[] = results.map((p) => {
      const inv = p.inventors?.[0];
      return {
        id: p.patent_number ?? "",
        title: p.patent_title ?? "Untitled",
        inventorName: `${inv?.inventor_first_name ?? ""} ${inv?.inventor_last_name ?? ""}`.trim(),
        grantDate: p.patent_date ?? "",
        sourceUrl: `https://patents.google.com/patent/US${p.patent_number}`,
        confidence: 0.8,
      };
    });

    if (r) { try { await r.set(key, patents, { ex: CACHE_TTL }); } catch {} }
    return patents;
  } catch (e) {
    logger.error("[uspto] findPatents failed:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
