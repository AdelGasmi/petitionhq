/**
 * gen-brand-assets.mjs — regenerate the static brand/OG assets in public/
 * from the single source of truth (app/icon.svg) + the /opengraph-image route.
 *
 * Outputs:
 *   public/favicon.ico        32×32 (PNG-in-ICO container)
 *   public/apple-touch-icon.png  180×180 (stone-900 bg, white mark)
 *   public/og-default.png     1200×630 (snapshot of /opengraph-image)
 *
 * Usage:
 *   1. Start the dev server (npm run dev) so /opengraph-image is reachable.
 *   2. node scripts/gen-brand-assets.mjs [baseUrl=http://localhost:3000]
 *
 * Re-run whenever app/icon.svg or app/opengraph-image.tsx changes.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pub = join(root, "public");
mkdirSync(pub, { recursive: true });

const svg = readFileSync(join(root, "app/icon.svg"));

// Wrap a 32×32 PNG buffer in a single-image ICO container (PNG-in-ICO is
// valid since Windows Vista and accepted by all modern browsers).
function pngToIco(png, size = 32) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size % 256, 0); // width (0 ⇒ 256)
  entry.writeUInt8(size % 256, 1); // height
  entry.writeUInt8(0, 2); // palette
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // bytes in image
  entry.writeUInt32LE(22, 12); // offset (6 + 16)
  return Buffer.concat([header, entry, png]);
}

const baseUrl = process.argv[2] ?? "http://localhost:3000";

const favPng = await sharp(svg).resize(32, 32).png().toBuffer();
writeFileSync(join(pub, "favicon.ico"), pngToIco(favPng, 32));
console.log("✓ public/favicon.ico");

await sharp(svg).resize(180, 180).png().toFile(join(pub, "apple-touch-icon.png"));
console.log("✓ public/apple-touch-icon.png");

const res = await fetch(`${baseUrl}/opengraph-image`);
if (!res.ok) throw new Error(`GET /opengraph-image → ${res.status} (is the dev server up?)`);
const og = Buffer.from(await res.arrayBuffer());
writeFileSync(join(pub, "og-default.png"), og);
console.log(`✓ public/og-default.png (${og.length} bytes)`);
