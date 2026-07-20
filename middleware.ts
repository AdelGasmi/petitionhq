/**
 * Route protection + rate limiting middleware.
 *
 * Uses jose directly (edge-compatible) — same JWT the auth helpers produce.
 * Checks:
 *   - Rate limiting (A-3) — per-IP via Upstash Redis with ephemeral cache
 *   - Public routes (/login, /setup, /api/auth/*) — always allowed
 *   - Everything else — must have a valid session cookie
 *   - /admin/* — must be admin role
 */

import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { checkRateLimit } from "@/lib/rate-limit";
import { Redis } from "@upstash/redis";
import { checkSvCache, setSvCache, type SvCache } from "@/lib/sessionRevocation";

// Prefix-based public paths — all sub-routes under these prefixes skip session auth.
// IMPORTANT: Only add prefixes here when ALL sub-routes under them are genuinely
// public. Broad prefixes are a common source of accidental auth bypass.
const PUBLIC_PATHS = [
  "/login", "/signup", "/verify", "/setup",
  "/api/auth", "/invite", "/api/invite",
  "/guest",       // guest case access (token-scoped in route handler)
  "/check",       // public NIW eligibility quiz
  "/api/check",   // powering /check page
  "/api/institutions", // ROR institution typeahead for /check wizard
  // NOTE: "/api/leads" is NOT here — the broad prefix would make [id]/* sub-routes
  // (claim, claim-ledger, dossier) accidentally public. Instead:
  //   - POST /api/leads (new lead) is covered by PUBLIC_EXACT below.
  //   - /api/leads/by-token/* is covered by the prefix below.
  "/api/leads/by-token",  // applicant consent flow — token-authenticated
  "/results",             // public assessment results (token-gated by URL)
  "/respond",             // applicant approve/reject attorney page
  "/review",      // recommender review portal (token-gated in route handler)
  "/api/review",  // review token endpoints
  "/intake",      // applicant intake (token-gated in route handler)
  "/api/intake",  // intake token endpoints
  "/api/health",  // monitoring / uptime checks
  "/api/diag",    // diagnostic (own x-cron-secret auth)
  "/api/storage", // local dev storage proxy
  "/api/cron",    // has own CRON_SECRET bearer auth
  // ── Public marketing / SEO surfaces ──────────────────────────────
  "/articles",
  "/eb2-niw-guide",
  "/eb2-niw-vs-eb1a",
  "/eb2-niw-processing-time",
  "/visa-categories",
  "/how-it-works",
  "/for-attorneys",
  "/verification",         // public verification-methodology page (in sitemap, linked from /for-attorneys)
  "/faq",
  "/about",
  "/privacy",
  "/terms",
  "/attorney-terms",        // public Attorney Platform Terms (linked from outreach emails + the acceptance gate)
  "/robots.txt",
  "/sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/manifest.webmanifest",
  "/opengraph-image",      // Next.js auto-generated OG card (must be public for social/LLM crawlers)
  "/twitter-image",        // Next.js auto-generated Twitter card
  "/og-default.png",
  "/apple-touch-icon.png",
  "/icon.svg",
  "/favicon.ico",
  "/googled26b4d95c6029394.html", // Google Search Console site-verification
];

// Exact-path public routes — only this precise path skips session auth,
// unlike PUBLIC_PATHS which matches all sub-routes via startsWith.
// New routes under /api/leads/* must be explicitly listed here or in PUBLIC_PATHS
// to get public access; they are NOT public by default.
const PUBLIC_EXACT = new Set([
  "/api/leads",  // anonymous lead creation from /check (POST — route handler enforces no-session)
]);

// ── S-13 Session revocation ──────────────────────────────────────────
let _svRedis: Redis | null = null;
const _svCache: SvCache = new Map();

async function isSessionRevoked(userId: string, jwtSv: number | undefined): Promise<boolean> {
  if (typeof jwtSv !== "number") return false; // old JWTs without sv — allow
  const now = Date.now();
  const cached = checkSvCache(userId, jwtSv, _svCache, now);
  if (cached !== null) return cached;
  // Redis check
  try {
    if (!_svRedis) {
      const url = process.env.UPSTASH_REDIS_REST_URL;
      const tok = process.env.UPSTASH_REDIS_REST_TOKEN;
      if (!url || !tok) return false;
      _svRedis = new Redis({ url, token: tok });
    }
    const min = await _svRedis.get<number>(`sv:${userId}`);
    const minV = min ?? 1;
    setSvCache(userId, minV, _svCache, now);
    return jwtSv < minV;
  } catch {
    // Fail closed on Redis error — see lib/sessionRevocation.ts for rationale.
    return true;
  }
}

function getSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET ?? "";
  return new TextEncoder().encode(raw);
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Rate limiting (runs before auth, fail-open) ──────────────────
  const ip = getClientIp(req);
  const rl = await checkRateLimit(ip, pathname);

  if (rl.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.reset ?? Date.now() + 60000 - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(rl.limit ?? 0),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rl.reset ?? 0),
        },
      },
    );
  }

  // ── Root path: static marketing page with logged-in redirect ────────
  // "/" is publicly accessible but logged-in users are redirected by role.
  // We check the cookie here so page.tsx can be statically rendered (no getSession).
  if (pathname === "/") {
    const token = req.cookies.get("petition_session")?.value;
    if (token) {
      try {
        const { payload: p } = await jwtVerify(token, getSecret());
        const role = (p as { role?: string }).role;
        if (role === "admin") return NextResponse.redirect(new URL("/admin", req.url));
        if (role === "attorney") return NextResponse.redirect(new URL("/network/dashboard", req.url));
        return NextResponse.redirect(new URL("/cases", req.url));
      } catch {
        // invalid/expired token — fall through and show the marketing page
      }
    }
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  // ── S-3 CSRF: reject cross-origin API mutations ──────────────────
  // Runs BEFORE the public-path skip so that even public API routes (lead
  // creation, by-token consent) get the Origin check. Absent Origin is
  // allowed for genuine server-to-server callers (/api/cron, webhooks with
  // their own auth). SameSite=Lax is the first line; this is defense-in-depth.
  if (pathname.startsWith("/api") && ["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin) {
      const host = req.headers.get("host") ?? "";
      const originHost = origin.replace(/^https?:\/\//, "");
      if (originHost !== host) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  // ── Public paths — skip session auth ────────────────────────────
  // PUBLIC_PATHS: all sub-routes under these prefixes are public.
  // PUBLIC_EXACT: only this exact path is public (fail-closed for sub-routes).
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    PUBLIC_EXACT.has(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    const res = NextResponse.next();
    res.headers.set("x-pathname", pathname);
    return res;
  }

  const token = req.cookies.get("petition_session")?.value;

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  let payload: { userId?: string; role?: string; name?: string; guestCaseId?: string; sv?: number } | null = null;
  try {
    const { payload: p } = await jwtVerify(token, getSecret());
    payload = p as { userId?: string; role?: string; name?: string; guestCaseId?: string; sv?: number };
  } catch {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("petition_session");
    return res;
  }

  // S-13: reject revoked sessions
  if (payload?.userId && await isSessionRevoked(payload.userId, payload.sv)) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete("petition_session");
    return res;
  }

  // Guest sessions are scoped to one case — restrict all navigation to that case
  if (payload?.guestCaseId) {
    const allowedPrefixes = [
      `/cases/${payload.guestCaseId}`,
      `/api/cases/${payload.guestCaseId}`,
    ];
    if (!allowedPrefixes.some((p) => pathname.startsWith(p))) {
      // S-25: Return 403 for cross-case guest access (was redirect, which hid the error)
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden — guest access is scoped to one case" }, { status: 403 });
      }
      return NextResponse.redirect(new URL(`/cases/${payload.guestCaseId}`, req.url));
    }
  }

  // /admin/* — admin only
  if (pathname.startsWith("/admin") && payload?.role !== "admin") {
    return NextResponse.redirect(new URL("/cases", req.url));
  }

  const res = NextResponse.next();
  res.headers.set("x-pathname", pathname);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
