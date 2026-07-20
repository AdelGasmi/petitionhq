import { describe, it, expect } from "vitest";
import { classifyRoute, type RateLimitTier } from "../lib/rate-limit";

describe("classifyRoute", () => {
  const cases: [string, RateLimitTier][] = [
    // Auth tier — strict
    ["/api/auth/login", "auth"],
    ["/api/auth/signup", "auth"],
    ["/api/auth/verify/send", "auth"],
    ["/api/auth/verify/check", "auth"],
    ["/api/invite/abc123", "auth"],
    ["/api/admin/invite-user", "auth"],
    ["/api/admin/invite-user/resend", "auth"],

    // API tier — moderate
    ["/api/check", "api"],
    ["/api/leads", "api"],
    ["/api/leads/abc/convert", "api"],
    ["/api/leads/abc/consent", "api"],
    ["/api/review/xyz", "api"],
    ["/api/intake/xyz", "api"],

    // General tier — relaxed (other /api/ routes)
    ["/api/cases/abc", "general"],
    ["/api/cases/abc/documents", "general"],
    ["/api/auth/google", "general"],

    // Skip — never rate-limited
    ["/_next/static/chunk.js", "skip"],
    ["/_next/data/abc.json", "skip"],
    ["/favicon.ico", "skip"],
    ["/api/health", "skip"],
    ["/api/diag", "skip"],
    ["/api/cron/nurture", "skip"],
    ["/api/cron/process-dossiers", "skip"],

    // Page navigations — skip
    ["/check", "skip"],
    ["/login", "skip"],
    ["/cases", "skip"],
    ["/", "skip"],
  ];

  for (const [pathname, expected] of cases) {
    it(`${pathname} → ${expected}`, () => {
      expect(classifyRoute(pathname)).toBe(expected);
    });
  }
});
