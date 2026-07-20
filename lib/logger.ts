/**
 * PII-scrubbing logger utility.
 *
 * Drop-in replacement for console.log / .warn / .error that recursively
 * redacts sensitive fields before they reach stdout / Docker logs.
 */

// ---------------------------------------------------------------------------
// Field-name sets
// ---------------------------------------------------------------------------

const EMAIL_FIELDS = new Set([
  "email",
  "to",
  "senderEmail",
  "recipientEmail",
]);

const PHONE_FIELDS = new Set(["phone", "phoneNumber"]);

const NAME_FIELDS = new Set([
  "name",
  "fullName",
  "senderName",
  "authorName",
  "applicantName",
  "attorneyName",
  "firstName",
  "lastName",
]);

const OPAQUE_FIELDS = new Set([
  "ssn",
  "socialSecurity",
  "aNumber",
  "passportNumber",
]);

// ---------------------------------------------------------------------------
// Redactors
// ---------------------------------------------------------------------------

function redactEmail(value: unknown): string {
  if (typeof value !== "string") return "***";
  const at = value.lastIndexOf("@");
  if (at > 0) return `***@${value.slice(at + 1)}`;
  return "***";
}

function redactPhone(value: unknown): string {
  if (typeof value !== "string") return "***";
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) return `***${digits.slice(-4)}`;
  return "***";
}

function redactName(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) return "***";
  return `${value[0]}***`;
}

// ---------------------------------------------------------------------------
// Core scrubber
// ---------------------------------------------------------------------------

const SEEN = Symbol("logger.seen");

function scrubValue(key: string, value: unknown, seen: Set<unknown>): unknown {
  const k = key.toLowerCase();

  // Check opaque fields first (exact match, case-insensitive)
  for (const f of OPAQUE_FIELDS) {
    if (k === f.toLowerCase()) return "***";
  }
  for (const f of EMAIL_FIELDS) {
    if (k === f.toLowerCase()) return redactEmail(value);
  }
  for (const f of PHONE_FIELDS) {
    if (k === f.toLowerCase()) return redactPhone(value);
  }
  for (const f of NAME_FIELDS) {
    if (k === f.toLowerCase()) return redactName(value);
  }

  // "to" field: only redact when the value looks like an email
  if (k === "to" && typeof value === "string" && value.includes("@")) {
    return redactEmail(value);
  }

  // Recurse into nested structures
  return scrub(value, seen);
}

/**
 * Recursively scrub PII from a value.
 * Handles primitives, plain objects, arrays, Errors, and Date objects.
 * Circular references are replaced with "[Circular]".
 */
export function scrub<T>(value: T, _seen?: Set<unknown>): T {
  if (value === null || value === undefined) return value;

  const t = typeof value;
  if (t === "number" || t === "boolean" || t === "bigint" || t === "symbol") {
    return value;
  }

  // Strings: attempt inline email/SSN/phone redaction in free text
  if (t === "string") {
    return scrubString(value as string) as unknown as T;
  }

  // Guard against circular references
  const seen = _seen ?? new Set<unknown>();
  if (seen.has(value)) return "[Circular]" as unknown as T;
  seen.add(value);

  // Error objects — scrub the message, preserve stack
  if (value instanceof Error) {
    const cleaned = new Error(scrubString(value.message));
    cleaned.name = value.name;
    if (value.stack) {
      cleaned.stack = value.stack.replace(value.message, cleaned.message);
    }
    return cleaned as unknown as T;
  }

  // Date — pass through
  if (value instanceof Date) return value;

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item, i) => scrubValue(String(i), item, seen)) as unknown as T;
  }

  // Plain objects (and class instances)
  if (t === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = scrubValue(k, v, seen);
    }
    return result as unknown as T;
  }

  return value;
}

// ---------------------------------------------------------------------------
// Inline string redaction — catches PII embedded in log messages
// ---------------------------------------------------------------------------

// Emails in free text
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}/g;
// US SSN patterns (xxx-xx-xxxx)
const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// US phone patterns: (xxx) xxx-xxxx, xxx-xxx-xxxx, +1xxxxxxxxxx
const PHONE_RE = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

function scrubString(s: string): string {
  let out = s;
  out = out.replace(EMAIL_RE, (match) => {
    const at = match.lastIndexOf("@");
    return `***@${match.slice(at + 1)}`;
  });
  out = out.replace(SSN_RE, "***-**-****");
  out = out.replace(PHONE_RE, (match) => {
    const digits = match.replace(/\D/g, "");
    return `***${digits.slice(-4)}`;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Scrub a single argument (handles all types the console methods accept)
// ---------------------------------------------------------------------------

function scrubArg(arg: unknown): unknown {
  if (arg instanceof Error) return scrub(arg);
  if (typeof arg === "string") return scrubString(arg);
  if (typeof arg === "object" && arg !== null) return scrub(arg);
  return arg;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function log(...args: unknown[]): void {
  console.log(...args.map(scrubArg));
}

export function info(...args: unknown[]): void {
  console.info(...args.map(scrubArg));
}

export function warn(...args: unknown[]): void {
  console.warn(...args.map(scrubArg));
}

export function error(...args: unknown[]): void {
  console.error(...args.map(scrubArg));
}

const logger = { log, info, warn, error, scrub };
export default logger;
