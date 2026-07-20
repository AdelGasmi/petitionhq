/**
 * NIH RePORTER API client for grant verification.
 * Docs: https://api.reporter.nih.gov/
 */

import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import logger from "@/lib/logger";
import { POLITE_USER_AGENT } from "./types";
import type { Grant } from "./types";

const BASE_URL = "https://api.reporter.nih.gov/v2/projects/search";
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

type NIHProject = {
  project_num?: string;
  project_title?: string;
  contact_pi_name?: string;
  project_start_date?: string;
  project_end_date?: string;
  award_amount?: number;
};

type NIHResponse = {
  results?: Array<{ project_num?: string } & NIHProject>;
  meta?: { total?: number };
};

/**
 * Find NIH grants by PI name, optionally filtered by institution.
 *
 * When `institution` is provided the criteria include `org_names` so
 * only grants at that institution are returned — this eliminates the
 * false-positive explosion for common names like "Sarah Chen".
 */
export async function findGrants(
  piName: string,
  institution?: string,
): Promise<Grant[]> {
  const cacheInput = institution ? `${piName}|${institution}` : piName;
  const r = getRedis();
  const key = `nih:grants:${createHash("sha256").update(cacheInput).digest("hex").slice(0, 16)}`;

  if (r) {
    try {
      const cached = await r.get<Grant[]>(key);
      if (cached) return cached;
    } catch {}
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": POLITE_USER_AGENT },
      signal: controller.signal,
      body: JSON.stringify({
        criteria: {
          pi_names: [{ any_name: piName }],
          ...(institution ? { org_names: [institution] } : {}),
        },
        limit: 20,
        offset: 0,
      }),
    });

    if (!res.ok) throw new Error(`NIH HTTP ${res.status}`);

    const data = (await res.json()) as NIHResponse;
    const results = data.results ?? [];

    const grants: Grant[] = results.map((p) => ({
      id: p.project_num ?? "",
      title: p.project_title ?? "Untitled",
      piName: p.contact_pi_name ?? piName,
      agency: "nih" as const,
      startDate: p.project_start_date,
      endDate: p.project_end_date,
      amount: p.award_amount,
      sourceUrl: `https://reporter.nih.gov/project-details/${p.project_num}`,
      confidence: 0.85,
    }));

    if (r) { try { await r.set(key, grants, { ex: CACHE_TTL }); } catch {} }
    return grants;
  } catch (e) {
    logger.error("[nih] findGrants failed:", e);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
