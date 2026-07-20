/**
 * Safe JSON body parser with size limit for App Router API routes.
 *
 * Next.js 15 App Router doesn't have built-in bodyParser.sizeLimit for
 * route handlers. This utility reads the body as text with a byte-length
 * check before parsing, preventing memory exhaustion from oversized payloads.
 *
 * Usage:
 *   const body = await parseJsonBody(req);         // default 1 MB
 *   const body = await parseJsonBody(req, 64_000); // custom 64 KB
 *
 * Throws a Response-ready object on failure (oversized or malformed JSON).
 */

const DEFAULT_MAX_BYTES = 1 * 1024 * 1024; // 1 MB

export class BodyTooLargeError extends Error {
  constructor(maxBytes: number) {
    super(`Request body exceeds ${Math.round(maxBytes / 1024)} KB limit`);
    this.name = "BodyTooLargeError";
  }
}

export class MalformedBodyError extends Error {
  constructor() {
    super("Request body is not valid JSON");
    this.name = "MalformedBodyError";
  }
}

/**
 * Parse a JSON request body with a byte-length safety check.
 *
 * Reads as text first (so we can measure bytes), then JSON.parse.
 * Content-Length is checked as a fast-reject hint but NOT trusted —
 * Next.js 15 can strip or rewrite it under chunked transfer encoding.
 * The actual text length is the authoritative check.
 */
export async function parseJsonBody<T = unknown>(
  req: Request,
  maxBytes: number = DEFAULT_MAX_BYTES,
): Promise<T> {
  // Fast-reject via Content-Length hint (not authoritative)
  const cl = req.headers.get("content-length");
  if (cl && parseInt(cl, 10) > maxBytes) {
    throw new BodyTooLargeError(maxBytes);
  }

  const text = await req.text();
  const byteLength = new TextEncoder().encode(text).byteLength;

  if (byteLength > maxBytes) {
    throw new BodyTooLargeError(maxBytes);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new MalformedBodyError();
  }
}
