/**
 * Crossref DOI resolver for publication verification.
 * Docs: https://api.crossref.org/swagger-ui/index.html
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT, POLITE_MAILTO } from "./types";
import type { CrossrefWork } from "./types";

const BASE_URL = "https://api.crossref.org";
const MAILTO = POLITE_MAILTO;
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

type CRWorkResponse = {
  status: string;
  message: {
    DOI: string;
    title?: string[];
    author?: Array<{ given?: string; family?: string }>;
    "published-print"?: { "date-parts"?: number[][] };
    "published-online"?: { "date-parts"?: number[][] };
    "container-title"?: string[];
    "is-referenced-by-count"?: number;
  };
};

/**
 * Resolve a DOI and return structured work data, or null.
 */
export async function resolveDoi(doi: string): Promise<CrossrefWork | null> {
  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//, "").trim();
  const r = getRedis();
  const key = `crossref:doi:${createHash("sha256").update(cleanDoi).digest("hex").slice(0, 16)}`;

  if (r) {
    try {
      const cached = await r.get<CrossrefWork | "null">(key);
      if (cached !== null && cached !== undefined) return cached === "null" ? null : cached;
    } catch {}
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${BASE_URL}/works/${encodeURIComponent(cleanDoi)}?mailto=${MAILTO}`, {
      headers: { Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
    });

    if (res.status === 404) {
      if (r) { try { await r.set(key, "null", { ex: CACHE_TTL }); } catch {} }
      return null;
    }
    if (!res.ok) throw new Error(`Crossref HTTP ${res.status}`);

    const data = (await res.json()) as CRWorkResponse;
    const msg = data.message;

    const year =
      msg["published-print"]?.["date-parts"]?.[0]?.[0] ??
      msg["published-online"]?.["date-parts"]?.[0]?.[0] ??
      0;

    const work: CrossrefWork = {
      doi: msg.DOI,
      title: msg.title?.[0] ?? "Untitled",
      authors: (msg.author ?? []).map((a) => `${a.given ?? ""} ${a.family ?? ""}`.trim()),
      publicationYear: year,
      journal: msg["container-title"]?.[0],
      citedByCount: msg["is-referenced-by-count"] ?? 0,
      sourceUrl: `https://doi.org/${msg.DOI}`,
    };

    if (r) { try { await r.set(key, work, { ex: CACHE_TTL }); } catch {} }
    return work;
  } catch (e) {
    logger.error("[crossref] resolveDoi failed:", e);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
