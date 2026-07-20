/**
 * Field-level AES-256-GCM encryption for PII stored in Case.formData.
 *
 * Only the specific fields that hold government-ID numbers (SSN, passport,
 * A-number, visa number, I-94) are encrypted; everything else stays plaintext
 * so normal queries and drafting logic are unaffected.
 *
 * Encryption is a no-op when FIELD_ENCRYPTION_KEY is absent (local dev, CI).
 * Encrypted values carry the prefix "enc:" so decryption can distinguish them
 * from legacy plaintext rows and from booleans/numbers in the JSON blob.
 *
 * Key rotation: to rotate, set FIELD_ENCRYPTION_KEY_PREV to the old key value.
 * decryptField will try the current key first, then the previous key. Re-encrypt
 * on next write. No migration script needed — rotation is lazy.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ── Key management ───────────────────────────────────────────────────────────

const ENC_PREFIX = "enc:";
const IV_LEN = 12;   // AES-GCM standard
const TAG_LEN = 16;  // AES-GCM auth tag

function loadKey(envVar: string): Buffer | null {
  const raw = process.env[envVar];
  if (!raw) return null;
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(`${envVar} must be a 32-byte value base64-encoded (got ${buf.length} bytes)`);
  }
  return buf;
}

function getCurrentKey(): Buffer | null {
  return loadKey("FIELD_ENCRYPTION_KEY");
}

function getPrevKey(): Buffer | null {
  return loadKey("FIELD_ENCRYPTION_KEY_PREV");
}

// ── Encrypt / decrypt single field ───────────────────────────────────────────

function encryptField(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Layout: iv(12) | tag(16) | ciphertext(N)
  return ENC_PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptField(value: string, key: Buffer): string {
  const buf = Buffer.from(value.slice(ENC_PREFIX.length), "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ── PII field registry ────────────────────────────────────────────────────────

// [section, field] paths that hold government-ID PII in Case.formData
const PII_PATHS: ReadonlyArray<readonly [string, string]> = [
  ["petitionerInfo",  "ssn"],
  ["petitionerInfo",  "passportNumber"],
  ["petitionerInfo",  "alienNumber"],
  ["petitionerInfo",  "i94Number"],
  ["applicant",       "ssn"],
  ["applicant",       "passportNumber"],
  ["applicant",       "alienNumber"],
  ["applicant",       "visaNumber"],
  ["applicant",       "i94Number"],
  ["petitioner",      "ssn"],
  ["petitioner",      "alienNumber"],
  ["beneficiary",     "ssn"],
  ["beneficiary",     "passportNumber"],
  ["beneficiary",     "alienNumber"],
] as const;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Encrypt all PII fields present in formData before writing to the DB.
 * Returns a new object — does not mutate the input.
 * No-op when FIELD_ENCRYPTION_KEY is not set.
 */
export function encryptPiiFields(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const key = getCurrentKey();
  if (!key) return formData;

  const result = { ...formData };
  for (const [section, field] of PII_PATHS) {
    const sec = result[section];
    if (!sec || typeof sec !== "object") continue;
    const secObj = sec as Record<string, unknown>;
    const val = secObj[field];
    if (typeof val !== "string" || val === "" || val.startsWith(ENC_PREFIX)) continue;
    result[section] = { ...secObj, [field]: encryptField(val, key) };
  }
  return result;
}

/**
 * Decrypt all PII fields after reading from the DB.
 * Returns a new object — does not mutate the input.
 * Handles: plaintext (legacy), encrypted with current key, encrypted with prev key.
 * No-op when FIELD_ENCRYPTION_KEY is not set.
 */
export function decryptPiiFields(
  formData: Record<string, unknown>,
): Record<string, unknown> {
  const key = getCurrentKey();
  if (!key) return formData;
  const prevKey = getPrevKey();

  const result = { ...formData };
  for (const [section, field] of PII_PATHS) {
    const sec = result[section];
    if (!sec || typeof sec !== "object") continue;
    const secObj = sec as Record<string, unknown>;
    const val = secObj[field];
    if (typeof val !== "string" || !val.startsWith(ENC_PREFIX)) continue;

    let decrypted: string | null = null;
    try {
      decrypted = decryptField(val, key);
    } catch {
      if (prevKey) {
        try { decrypted = decryptField(val, prevKey); } catch { /* fall through */ }
      }
    }
    if (decrypted !== null) {
      result[section] = { ...secObj, [field]: decrypted };
    }
  }
  return result;
}
