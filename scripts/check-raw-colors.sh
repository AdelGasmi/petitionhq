#!/usr/bin/env bash
# T7-1 — Raw-color lint wall.
#
# The design system uses semantic tokens (DESIGN.md §2 / styles/themes/*.css):
# bg-surface-*, text-text-*, border-border-*, bg-success-*, etc. Raw Tailwind
# palette classes (bg-stone-500, text-green-800, …) are banned in app/ and
# components/ — they bypass theming and broke visual consistency before the
# Phase-2 migration (ui_ux_enhancement.md). This guard keeps the count at 0.
#
# Styles live in styles/themes/ (the palette source of truth) — not scanned.
set -euo pipefail
cd "$(dirname "$0")/.."

# Every Tailwind palette family, so a stray color of ANY hue is caught.
PALETTES='stone|slate|gray|zinc|neutral|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|red|orange|amber|yellow|lime'
PATTERN="(bg|text|border|ring|ring-offset|from|via|to|divide|outline|fill|stroke|placeholder|decoration|accent|caret|shadow)-($PALETTES)-[0-9]+"

matches=$(git grep -nE "$PATTERN" -- 'app/**/*.tsx' 'components/**/*.tsx' || true)

if [[ -n "$matches" ]]; then
  count=$(echo "$matches" | wc -l | tr -d ' ')
  echo "❌ $count raw Tailwind palette class(es) found — use semantic tokens (DESIGN.md §2):"
  echo ""
  echo "$matches"
  echo ""
  echo "Map raw → semantic, e.g.:  text-stone-600 → text-text-secondary,"
  echo "  bg-white → bg-surface-card,  bg-green-100 → bg-success-soft,"
  echo "  text-red-600 → text-danger-fill,  bg-stone-900 → bg-brand-primary."
  echo "Cheat-sheet: ui_ux_enhancement.md, Phase 2 header."
  exit 1
fi

echo "✅ No raw palette classes in app/ or components/ — semantic tokens only."
