/**
 * Route-handler safety net (P1.2 from codebase_refactor.md).
 *
 * Wrap a Next.js App Router handler so any *unexpected* throw — a Prisma error,
 * a JSON parse blowing up outside a guarded spot, anything — becomes a clean
 * `{ error }` JSON response instead of a raw Next.js 500 that leaks a stack and
 * never reaches our PII-scrubbing logger. Expected errors stay explicit:
 * handlers keep returning `NextResponse.json({ error }, { status })` as before,
 * or `throw new ApiError(status, msg)` / `apiError(status, msg)` to bail out.
 *
 * Wrapping is purely additive — existing returns are untouched. Adopt it
 * incrementally, mutations first.
 *
 * Usage:
 *   async function _POST(req: NextRequest, { params }: Ctx) { ... }
 *   export const POST = withRoute(_POST);
 */
import { NextResponse, type NextRequest } from "next/server";
import logger from "@/lib/logger";

/** A deliberate, client-facing error: short-circuits the handler with a status. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Throw a typed client-facing error from anywhere inside a wrapped handler. */
export function apiError(status: number, message: string): never {
  throw new ApiError(status, message);
}

/**
 * Wrap a route handler with a catch-all. Rest-args generic preserves each
 * route's own context type (`{ params: Promise<…> }`), so wrapping is type-safe
 * for handlers with or without route params.
 */
export function withRoute<A extends unknown[]>(
  handler: (req: NextRequest, ...args: A) => Promise<Response> | Response,
): (req: NextRequest, ...args: A) => Promise<Response> {
  return async (req, ...args) => {
    try {
      return await handler(req, ...args);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      let path = "?";
      try {
        path = new URL(req.url).pathname;
      } catch {
        /* req.url malformed — keep the placeholder */
      }
      // Scrubbed by lib/logger before it reaches stdout / Docker logs.
      logger.error(`[api] ${req.method} ${path} failed:`, e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
