/**
 * Session revocation check — extracted from middleware for testability.
 *
 * Design: fail CLOSED on Redis errors. If Redis is unreachable we deny access
 * rather than allow a potentially-revoked session through. Availability
 * tradeoff: active users are also denied until Redis recovers, but this is
 * preferable to letting a suspended user remain active indefinitely.
 * Rate-limiting deliberately stays fail-open (availability > strictness there).
 */

export type SvCache = Map<string, { v: number; ts: number }>;

const CACHE_TTL_MS = 30_000;

/** Returns cached verdict (true = revoked, false = valid), or null on miss. */
export function checkSvCache(
  userId: string,
  jwtSv: number,
  cache: SvCache,
  now = Date.now(),
): boolean | null {
  const entry = cache.get(userId);
  if (entry && now - entry.ts < CACHE_TTL_MS) {
    return jwtSv < entry.v;
  }
  return null;
}

/** Stores a fetched minV in the cache. */
export function setSvCache(userId: string, minV: number, cache: SvCache, now = Date.now()): void {
  cache.set(userId, { v: minV, ts: now });
}
