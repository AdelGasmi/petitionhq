/**
 * Storage abstraction — local disk (dev) or Cloudflare R2 (prod).
 *
 * Two-bucket model:
 *   SECURE bucket  (petitionhq-secure-data)   — user CVs, intake forms, evidence docs
 *                  Always private. Access via presigned GET URLs (15-min TTL).
 *                  Presigned PUT URLs allow direct browser → R2 uploads (no server bandwidth).
 *
 *   PUBLIC bucket  (petitionhq-public-assets)  — logos, UI images, marketing assets
 *                  Public access enabled. Served via assets.petitionhq.us custom domain.
 *                  No signing needed.
 *
 * Env vars:
 *   STORAGE_BACKEND=local|r2         (default: local)
 *   R2_ENDPOINT                      https://<account-id>.r2.cloudflarestorage.com
 *   R2_BUCKET_SECURE                 petitionhq-secure-data
 *   R2_BUCKET_PUBLIC                 petitionhq-public-assets
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_PUBLIC_URL                    https://assets.petitionhq.us
 *
 * Legacy compat:
 *   R2_BUCKET still works if R2_BUCKET_SECURE is not set.
 */

import { join } from "path";
import { promises as fs } from "fs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type StorageBackend = "local" | "r2";
export type StorageBucketType = "secure" | "public";

// ─── Config ──────────────────────────────────────────────────────────────────

function backend(): StorageBackend {
  return (process.env.STORAGE_BACKEND ?? "local") === "r2" ? "r2" : "local";
}

const LOCAL_ROOT = process.env.STORAGE_LOCAL_PATH ?? join(process.cwd(), "data", "storage");

// ─── S3 client (lazy singleton) ──────────────────────────────────────────────

let _s3: import("@aws-sdk/client-s3").S3Client | null = null;

async function getS3() {
  if (_s3) return _s3;
  const { S3Client } = await import("@aws-sdk/client-s3");
  _s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    forcePathStyle: true,   // required for MinIO (local) and Cloudflare R2
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return _s3;
}

// Bucket selectors
function secureBucket(): string {
  return process.env.R2_BUCKET_SECURE ?? process.env.R2_BUCKET ?? "petitionhq-secure-data";
}

function publicBucket(): string {
  return process.env.R2_BUCKET_PUBLIC ?? "petitionhq-public-assets";
}

function getBucket(type: StorageBucketType = "secure"): string {
  return type === "public" ? publicBucket() : secureBucket();
}

// ─── Core read / write / delete ───────────────────────────────────────────────

/**
 * Store `buffer` at `key` in the given bucket.
 * Defaults to secure bucket. Use type="public" for static assets.
 *
 * Key format: "uploads/<caseId>/<docId>/<filename>"  (secure)
 *             "assets/<filename>"                    (public)
 */
export async function storagePut(
  key: string,
  buffer: Buffer,
  mimeType = "application/octet-stream",
  type: StorageBucketType = "secure"
): Promise<void> {
  if (backend() === "r2") {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = await getS3();
    await s3.send(new PutObjectCommand({
      Bucket: getBucket(type),
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      ContentLength: buffer.byteLength,
    }));
  } else {
    const fullPath = join(LOCAL_ROOT, type, key);
    await fs.mkdir(fullPath.substring(0, fullPath.lastIndexOf("/")), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }
}

/**
 * Read an object from the secure bucket as a Buffer.
 */
export async function storageGet(key: string, type: StorageBucketType = "secure"): Promise<Buffer> {
  if (backend() === "r2") {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = await getS3();
    const res = await s3.send(new GetObjectCommand({ Bucket: getBucket(type), Key: key }));
    if (!res.Body) throw new Error(`Storage: empty body for key ${key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  } else {
    return fs.readFile(join(LOCAL_ROOT, type, key));
  }
}

/**
 * Delete an object. Silently no-ops if key doesn't exist.
 */
export async function storageDelete(key: string, type: StorageBucketType = "secure"): Promise<void> {
  if (backend() === "r2") {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = await getS3();
    await s3.send(new DeleteObjectCommand({ Bucket: getBucket(type), Key: key }));
  } else {
    try { await fs.unlink(join(LOCAL_ROOT, type, key)); } catch { /* not found */ }
  }
}

/**
 * Check if a key exists.
 */
export async function storageExists(key: string, type: StorageBucketType = "secure"): Promise<boolean> {
  if (backend() === "r2") {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = await getS3();
    try {
      await s3.send(new HeadObjectCommand({ Bucket: getBucket(type), Key: key }));
      return true;
    } catch { return false; }
  } else {
    try { await fs.stat(join(LOCAL_ROOT, type, key)); return true; } catch { return false; }
  }
}

/**
 * List keys with a given prefix.
 */
export async function storageList(prefix: string, type: StorageBucketType = "secure"): Promise<string[]> {
  if (backend() === "r2") {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const s3 = await getS3();
    const res = await s3.send(new ListObjectsV2Command({ Bucket: getBucket(type), Prefix: prefix }));
    return (res.Contents ?? []).map((o) => o.Key!).filter(Boolean);
  } else {
    const dir = join(LOCAL_ROOT, type, prefix);
    try {
      const entries = await (fs.readdir as unknown as (d: string, opts: object) => Promise<{isFile(): boolean; name: string}[]>)(dir, { withFileTypes: true, recursive: true });
      return (entries as { isFile(): boolean; name: string }[])
        .filter((e) => e.isFile())
        .map((e) => join(prefix, e.name));
    } catch { return []; }
  }
}

// ─── Presigned URLs ───────────────────────────────────────────────────────────

/**
 * Generate a presigned GET URL for SECURE bucket (time-limited download link).
 * S-20: Default TTL tightened to 3 minutes for GET.
 *
 * For PUBLIC bucket objects, returns the public CDN URL immediately (no signing needed).
 * For LOCAL backend, returns /api/storage/<key> proxy path.
 */
export async function storageSignUrl(
  key: string,
  ttlSeconds = 180,                // S-20: 3 min default (tightened from 15 min)
  type: StorageBucketType = "secure"
): Promise<string> {
  if (backend() === "r2") {
    // Public bucket → CDN URL, no signing
    if (type === "public") {
      const base = process.env.R2_PUBLIC_URL ?? `https://${publicBucket()}.r2.cloudflarestorage.com`;
      return `${base.replace(/\/$/, "")}/${key}`;
    }
    // Secure bucket → presigned GET URL
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = await getS3();
    return getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: secureBucket(), Key: key }),
      { expiresIn: ttlSeconds }
    );
  } else {
    // Local dev → proxy through Next.js API
    return `/api/storage/${encodeURIComponent(key)}`;
  }
}

/**
 * Generate a presigned PUT URL so the browser can upload directly to the SECURE R2 bucket
 * without routing the file through the Next.js server.
 *
 * Returns: { url: string, key: string }
 *   url  — PUT this URL from the browser (Content-Type header required)
 *   key  — store this in the DB (use with storageSignUrl to retrieve later)
 *
 * @param key         Storage key, e.g. "uploads/<caseId>/<docId>/<filename>"
 * @param mimeType    Content-Type the browser will send (must match)
 * @param ttlSeconds  How long the PUT URL is valid (S-20: tightened to 5 min)
 */
export async function storagePresignPut(
  key: string,
  mimeType = "application/octet-stream",
  ttlSeconds = 300                  // S-20: 5 min default (tightened from 10 min)
): Promise<{ url: string; key: string }> {
  if (backend() !== "r2") {
    // Local dev: return a fake presign — client should POST to /api/upload instead
    return { url: `/api/storage-upload/${encodeURIComponent(key)}`, key };
  }
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = await getS3();
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: secureBucket(),
      Key: key,
      ContentType: mimeType,
    }),
    { expiresIn: ttlSeconds }
  );
  return { url, key };
}

/**
 * Public bucket URL helper — returns the CDN URL for a public asset.
 * No signing, no async. Use for logos, UI images, public marketing assets.
 */
export function storagePublicUrl(key: string): string {
  const base = process.env.R2_PUBLIC_URL ?? "https://assets.petitionhq.us";
  return `${base.replace(/\/$/, "")}/${key}`;
}
