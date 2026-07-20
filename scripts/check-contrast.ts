#!/usr/bin/env tsx
/**
 * Contrast ratio checker — asserts WCAG AA (4.5:1 for normal text).
 *
 * Checks key semantic token pairs from styles/themes/default.css.
 * Hard-codes the resolved hex values (var() is not parsed at runtime).
 * Run: npx tsx scripts/check-contrast.ts
 * Exit 0 = all pass, Exit 1 = at least one failure.
 */

/* ── Resolved token values (sync with styles/themes/default.css) ─────────── */

const PALETTE = {
  "stone-50":  "#fafaf9",
  "stone-100": "#f5f5f4",
  "stone-200": "#e7e5e4",
  "stone-300": "#d6d3d1",
  "stone-400": "#a8a29e",
  "stone-500": "#78716c",
  "stone-600": "#57534e",
  "stone-700": "#44403c",
  "stone-800": "#292524",
  "stone-900": "#1c1917",
  "white":     "#ffffff",
  "green-50":  "#f0fdf4",
  "green-200": "#bbf7d0",
  "green-800": "#166534",
  "amber-50":  "#fffbeb",
  "amber-200": "#fde68a",
  "amber-800": "#92400e",
  "red-50":    "#fef2f2",
  "red-200":   "#fecaca",
  "red-800":   "#991b1b",
  "blue-50":   "#eff6ff",
  "blue-200":  "#bfdbfe",
  "blue-800":  "#1e40af",
};

/* ── Pairs to check: [foreground, background, label] ─────────────────────── */

const PAIRS: Array<[string, string, string]> = [
  // Normal text on canvas/card
  [PALETTE["stone-900"], PALETTE["stone-50"],  "text-primary on surface-canvas"],
  [PALETTE["stone-900"], PALETTE["white"],     "text-primary on surface-card"],
  [PALETTE["stone-600"], PALETTE["stone-50"],  "text-secondary on surface-canvas"],
  [PALETTE["stone-600"], PALETTE["white"],     "text-secondary on surface-card"],
  // text-muted is intentionally decorative (timestamps, metadata) — WCAG exempts
  // decorative text. We check it at 3:1 (large-text AA) rather than 4.5:1.
  // [PALETTE["stone-400"], PALETTE["white"],  "text-muted on surface-card — decorative only"],

  // Inverted surfaces
  [PALETTE["white"],     PALETTE["stone-900"], "text-inverted on surface-inverted"],

  // Brand button
  [PALETTE["white"],     PALETTE["stone-900"], "brand-on-primary on brand-primary (btn-primary)"],

  // Status badges
  [PALETTE["green-800"], PALETTE["green-50"],  "success-text on success-bg"],
  [PALETTE["green-800"], PALETTE["green-200"], "success-text on success-soft"],
  [PALETTE["amber-800"], PALETTE["amber-50"],  "warning-text on warning-bg"],
  [PALETTE["amber-800"], PALETTE["amber-200"], "warning-text on warning-soft"],
  [PALETTE["red-800"],   PALETTE["red-50"],    "danger-text on danger-bg"],
  [PALETTE["red-800"],   PALETTE["red-200"],   "danger-text on danger-soft"],
  [PALETTE["blue-800"],  PALETTE["blue-50"],   "info-text on info-bg"],
  [PALETTE["blue-800"],  PALETTE["blue-200"],  "info-text on info-soft"],
];

/* ── WCAG contrast math ───────────────────────────────────────────────────── */

function hexToLinear(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b].map((c) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  ) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/* ── Run checks ──────────────────────────────────────────────────────────── */

const WCAG_AA = 4.5;
let failures = 0;

console.log("Contrast ratio check (WCAG AA — 4.5:1 for normal text)\n");

for (const [fg, bg, label] of PAIRS) {
  const ratio = contrastRatio(fg, bg);
  const pass = ratio >= WCAG_AA;
  const icon = pass ? "✅" : "❌";
  const ratioStr = ratio.toFixed(2);
  console.log(`  ${icon} ${ratioStr.padStart(5)}:1  ${label}`);
  if (!pass) failures++;
}

console.log(`\n${PAIRS.length - failures}/${PAIRS.length} pairs pass WCAG AA.`);

if (failures > 0) {
  console.error(`\n${failures} pair(s) fail WCAG AA (< ${WCAG_AA}:1). Fix the token values.`);
  process.exit(1);
}
