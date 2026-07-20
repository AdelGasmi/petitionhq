/**
 * S-13 Session revocation via Redis.
 *
 * When a user changes their password (or an admin force-logs them out),
 * we increment User.sessionVersion in the DB and write the new minimum
 * to Redis. Middleware reads Redis on each authenticated request and
 * rejects JWTs whose `sv` claim is below the stored minimum.
 *
 * Graceful degradation: if Redis is unavailable, all checks pass through.
 */

import { Redis } from "@upstash/redis";
import logger from "./logger";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// JWT lifetime — revocation keys expire after the same period so we don't
// accumulate stale entries for users who never log in again.
const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * Write the minimum acceptable sessionVersion for a user to Redis.
 * Any JWT with sv < minVersion will be rejected by middleware.
 */
export async function setSessionRevocationVersion(
  userId: string,
  minVersion: number,
): Promise<void> {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(`sv:${userId}`, minVersion, { ex: SESSION_TTL });
  } catch (e) {
    logger.error("[session-revoke] Redis write failed:", e);
  }
}

/**
 * Get the minimum acceptable sessionVersion for a user.
 * Returns null if Redis is unavailable (caller should fail open).
 */
export async function getMinSessionVersion(userId: string): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    return await r.get<number>(`sv:${userId}`);
  } catch {
    return null;
  }
}
