/**
 * Rate limiting via @upstash/ratelimit with ephemeral cache.
 *
 * Uses an in-memory ES6 Map to avoid hitting Redis on every middleware
 * invocation (which runs on EVERY request including static assets).
 * Without ephemeralCache, each request = 1 Redis RTT = 30-50ms latency.
 *
 * Three tiers:
 *   - auth:    strict (10 req / 60s) — login, signup, verify, invite
 *   - api:     moderate (30 req / 60s) — /check, /leads, public API
 *   - general: relaxed (60 req / 60s) — authenticated routes
 *
 * Keyed by IP address. Falls back to x-forwarded-for → "unknown".
 *
 * Graceful degradation: if UPSTASH_REDIS_REST_URL is not set or Redis
 * is unreachable, all requests are allowed through. Rate limiting is a
 * defense-in-depth measure, not a gating function.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import logger from "./logger";

// ─── Ephemeral cache ────────────────────────────────────────────────
// Shared across all limiters in this Edge worker instance.
// Prevents redundant Redis calls for requests within the sliding window.
const cache = new Map();

// ─── Redis client (lazy singleton) ──────────────────────────────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// ─── Rate limiters ──────────────────────────────────────────────────

let authLimiter: Ratelimit | null = null;
let apiLimiter: Ratelimit | null = null;
let generalLimiter: Ratelimit | null = null;

function getAuthLimiter(): Ratelimit | null {
  if (authLimiter) return authLimiter;
  const r = getRedis();
  if (!r) return null;
  authLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "rl:auth",
    ephemeralCache: cache,
    analytics: false,
  });
  return authLimiter;
}

function getApiLimiter(): Ratelimit | null {
  if (apiLimiter) return apiLimiter;
  const r = getRedis();
  if (!r) return null;
  apiLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(30, "60 s"),
    prefix: "rl:api",
    ephemeralCache: cache,
    analytics: false,
  });
  return apiLimiter;
}

function getGeneralLimiter(): Ratelimit | null {
  if (generalLimiter) return generalLimiter;
  const r = getRedis();
  if (!r) return null;
  generalLimiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "rl:gen",
    ephemeralCache: cache,
    analytics: false,
  });
  return generalLimiter;
}

// ─── Route classification ───────────────────────────────────────────

const AUTH_PREFIXES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/verify",
  "/api/invite",
  "/api/admin/invite-user",
];

const API_PREFIXES = [
  "/api/check",
  "/api/leads",
  "/api/review",
  "/api/intake",
];

export type RateLimitTier = "auth" | "api" | "general" | "skip";

export function classifyRoute(pathname: string): RateLimitTier {
  // Never rate-limit static assets, health checks, or internal Next.js routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname === "/api/health" ||
    pathname === "/api/diag" ||
    pathname.startsWith("/api/cron")
  ) {
    return "skip";
  }

  if (AUTH_PREFIXES.some((p) => pathname.startsWith(p))) return "auth";
  if (API_PREFIXES.some((p) => pathname.startsWith(p))) return "api";

  // Only rate-limit API routes in the general tier, not page navigations
  if (pathname.startsWith("/api/")) return "general";

  return "skip";
}

// ─── Public API ─────────────────────────────────────────────────────

export type RateLimitResult = {
  limited: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
};

/**
 * Check rate limit for a request. Returns { limited: false } if:
 *   - Redis is not configured (graceful degradation)
 *   - The route tier is "skip"
 *   - Redis is unreachable (fail-open)
 */
export async function checkRateLimit(
  ip: string,
  pathname: string,
): Promise<RateLimitResult> {
  const tier = classifyRoute(pathname);
  if (tier === "skip") return { limited: false };

  const limiter =
    tier === "auth" ? getAuthLimiter() :
    tier === "api" ? getApiLimiter() :
    getGeneralLimiter();

  // Graceful degradation — no Redis config
  if (!limiter) return { limited: false };

  try {
    const result = await limiter.limit(ip);
    return {
      limited: !result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (e) {
    // Redis unreachable — fail open
    logger.error("[rate-limit] Redis error, allowing request:", e);
    return { limited: false };
  }
}
