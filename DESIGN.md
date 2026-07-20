# DESIGN.md — PetitionHQ Design System

> This file is the source of truth for all UI work on petitionhq.us.
> **Every agent and every contributor must read this before touching `app/`, `components/`, or `globals.css`.**
> If a rule here conflicts with code you find in the repo, the rule wins — the code is out of date and needs migration.

---

## 0. Why this exists

PetitionHQ is a LegalTech product. Users (immigration applicants, partner attorneys, admins) entrust us with high-stakes decisions and sensitive personal data. The UI is not decoration — it is the primary signal of institutional credibility. Inconsistent radii, mismatched buttons, ad-hoc colors, and missing focus rings all corrode trust before a single feature is evaluated.

This system has four goals, in order:

1. **Trust signal** — surfaces feel like the same product, no matter the page.
2. **Theme-swappable** — palette and typography are one-file changes.
3. **Accessibility by default** — WCAG 2.1 AA is the floor, not the ceiling.
4. **Agent-friendly** — rules are mechanical enough that an LLM or linter can enforce them.

---

## 1. The 10 rules (read this first)

1. **Never write a hex color, rgb(), or hsl() in JSX or CSS.** Use tokens (`var(--color-…)`) or the semantic Tailwind aliases declared in `tailwind.config.ts`.
2. **Never use a raw Tailwind color name** (`bg-stone-900`, `text-amber-700`) in component files. Use the semantic alias (`bg-surface-inverted`, `text-status-warning`). Raw color classes are allowed only inside `styles/themes/*.css`.
3. **Never write a custom card.** Use `.card`, `.card-lg`, or `.card-feature`. If none fit, propose a new variant in this file before adding it.
4. **Never write a custom button.** Use `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`. Size variants: `.btn-sm`, `.btn-lg`.
5. **Never write a custom badge.** Use `.badge` + a status modifier: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info`, `.badge-neutral`.
6. **Never use emoji as functional UI** (icons, status, loaders). Use the icon set in `components/icons/`. Emoji is allowed only inside user-generated content.
7. **Never invent a tier/score threshold.** Import `tierFor()` from `lib/scoring.ts`. There is one threshold table for the whole app.
8. **Every interactive element must have `:focus-visible`.** The `.btn` and `.input` classes already include it — do not override with `focus:outline-none`.
9. **Every container with a max width uses `max-w-content`** (= 1152px). Page-level padding is `px-4 py-8 sm:px-6 sm:py-10` (responsive — narrower on mobile). Hero/funnel content uses `max-w-prose` (= 672px).
10. **No `forwardRef`, no `useImperativeHandle`, no portals** unless a primitive truly requires them. Composition over abstraction.
11. **All grids are mobile-first.** Every `grid-cols-N` must have a `grid-cols-1` base (no prefix). Add `sm:` / `lg:` variants for wider breakpoints. A grid without a mobile base is a bug.

---

## 2. Token taxonomy

Tokens live in CSS custom properties on `:root` in `styles/themes/default.css`. Tailwind's `theme.extend` aliases them so utility classes resolve to tokens — never raw values.

### 2.1 Color tokens

Three layers, in order from concrete to abstract. **Components consume only the semantic layer.**

```
Layer 1 — palette (theme file only)
  --palette-stone-50 … --palette-stone-900
  --palette-green-50 … --palette-green-700
  --palette-amber-50 … --palette-amber-700
  --palette-red-50   … --palette-red-700
  --palette-blue-50  … --palette-blue-700

Layer 2 — semantic (consumed by Layer 3 + components)
  Surfaces:
    --surface-canvas      page background          (stone-50)
    --surface-card        elevated container       (white)
    --surface-muted       subtle fill              (stone-100)
    --surface-inverted    dark surface             (stone-900)
    --surface-overlay     modal/overlay backdrop   (rgba 0 0 0 / 0.5)

  Text:
    --text-primary        body, headings           (stone-900)
    --text-secondary      supporting text          (stone-600)
    --text-muted          captions, metadata       (stone-400)
    --text-inverted       on dark surfaces         (white)
    --text-link           inline links             (stone-900, underline)

  Borders:
    --border-subtle       between rows             (stone-100)
    --border-default      card edges, inputs       (stone-200)
    --border-strong       focused/active           (stone-400)

  Status (each has -bg, -border, -text, -fill):
    --status-success-*    (green family)
    --status-warning-*    (amber family)
    --status-danger-*     (red family)
    --status-info-*       (blue family)
    --status-neutral-*    (stone family)

  Brand:
    --brand-primary       main CTAs                (stone-900)
    --brand-primary-hover                          (stone-700)
    --brand-on-primary    text on brand            (white)

  Accent (NOT a status — the product's color identity beyond the neutral spine;
          use for primary-metric emphasis, sparklines, active states, viz fills):
    --accent-fill/-text/-bg/-border/-soft          (indigo family)

  Data-viz (direction/magnitude in charts, deltas, sparklines):
    --viz-positive  (green) | --viz-negative (red) | --viz-track | --viz-spark

  Focus:
    --focus-ring          a11y outline             (stone-500 @ 0.4 alpha)
```

### 2.2 Type tokens

Modular scale, ratio 1.25, base 16px. Heading font is `--font-display` (Fraunces). Body is `--font-body` (Inter). UI mono is `--font-mono`.

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-xs` | 12px | 1.4 | metadata, microcopy, badges |
| `--text-sm` | 14px | 1.45 | body default, form labels |
| `--text-base` | 16px | 1.55 | long-form content |
| `--text-lg` | 18px | 1.4 | h3, card titles |
| `--text-xl` | 20px | 1.35 | h2, section headers |
| `--text-2xl` | 24px | 1.3 | page titles (admin/dashboards) |
| `--text-3xl` | 30px | 1.2 | page titles (applicant-facing) |
| `--text-4xl` | 36px | 1.15 | hero headlines |
| `--text-5xl` | 48px | 1.1 | landing/marketing only |

Weight tokens: `--weight-regular` (400), `--weight-medium` (500), `--weight-semibold` (600), `--weight-bold` (700).

### 2.3 Spacing tokens

4px base grid. Use Tailwind's default spacing scale — do not introduce parallel values. Never use arbitrary values (`p-[18px]`, `mt-[7px]`). The only allowed arbitrary value is `1px` for hairlines.

### 2.4 Radius tokens

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 4px | inputs, badges |
| `--radius-md` | 6px | buttons, secondary cards |
| `--radius-lg` | 8px | default card |
| `--radius-xl` | 12px | feature cards, dashboards |
| `--radius-2xl` | 16px | hero blocks, modals |
| `--radius-full` | 9999px | pills, avatars |

### 2.5 Shadow tokens

| Token | Use |
|---|---|
| `--shadow-xs` | resting buttons, hairline lift |
| `--shadow-sm` | default cards |
| `--shadow-md` | hover lift, dropdowns |
| `--shadow-lg` | modals, popovers |
| `--shadow-focus` | focus rings (drives `:focus-visible`) |

### 2.6 Motion tokens

| Token | Value | Use |
|---|---|---|
| `--duration-fast` | 120ms | hover, color transitions |
| `--duration-base` | 180ms | open/close, slide |
| `--duration-slow` | 300ms | page transitions |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | default exit |
| `--ease-in-out` | `cubic-bezier(0.65, 0, 0.35, 1)` | bidirectional |

**Honor `prefers-reduced-motion`** — every keyframe and transition is wrapped by the `motion-safe:` Tailwind variant or by `@media (prefers-reduced-motion: no-preference)`.

---

## 3. Component catalog

Each entry: when to use, what it looks like, the canonical class, accessibility notes.

### 3.1 `.card`, `.card-lg`, `.card-feature`

```
.card           rounded-lg, border, bg surface-card, p-6, shadow-sm
.card-lg        rounded-2xl, border, bg surface-card, p-8, shadow-sm   (wizard panels, hero blocks)
.card-feature   rounded-xl, border-2 border-strong, p-6, shadow-md      (the one CTA per page)
```

States: `:hover` on interactive cards only — add `.card-interactive` modifier (adds `cursor-pointer`, hover shadow, focus ring).

### 3.2 `.btn-*`

Sizes: `.btn` (default md, h-10), `.btn-sm` (h-8 text-xs), `.btn-lg` (h-12 text-base).
Variants: `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`.
States: `:hover`, `:focus-visible`, `:disabled` (opacity-50, cursor-not-allowed), `[data-loading="true"]` (shows spinner, disables click).

**Loading pattern**: `<button className="btn btn-primary" data-loading={loading}>…</button>` — the CSS handles the spinner. Never inline `{loading ? 'Saving…' : 'Save'}` ternaries.

### 3.3 `.input`, `.textarea`, `.select`

All share base styling (`.field`) and add their own concerns. The `.field-error` modifier turns the border red and adds an aria-invalid-friendly outline. Pair with `<p className="field-hint">` (default) or `<p className="field-error-msg">` (validation).

Required affordance: `<label className="field-label" htmlFor="x">Label <span className="field-required">*</span></label>`.

### 3.4 `.badge`

```
<span className="badge badge-success">Strong</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-danger">Disqualified</span>
<span className="badge badge-info">New</span>
<span className="badge badge-neutral">Draft</span>
```

For role chips (admin/attorney/applicant), use `.badge-role-{role}`.

### 3.5 `.alert`

Notice strips at the top of pages or sections.

```
<div className="alert alert-warning">…</div>
<div className="alert alert-info">…</div>
```

Modifier `.alert-dismissible` adds a close button + role="alert" semantics.

### 3.6 `.empty-state`

The pattern used in `cases/page.tsx`, `network/dashboard/page.tsx`, admin tables.

```
<div className="empty-state">
  <Icon name="folder-open" className="empty-state-icon" />
  <p className="empty-state-title">No cases yet</p>
  <p className="empty-state-body">Start your first case to begin building your petition.</p>
  <Link href="/cases/new" className="btn btn-primary btn-sm">New case</Link>
</div>
```

### 3.7 `.score-meter`, `.score-ring`

Replace the three duplicated SVG ring components in `check/page.tsx`, `check/result/[leadId]/page.tsx`, and `LetterEditor.tsx`. One component, one source of color logic (driven by `tierFor()`).

### 3.8 Table primitives

`.table-shell` (outer card), `.table-row` (hover, focus), `.table-header-cell`, `.table-cell`. Used by admin/leads, network/dashboard, admin/users.

**Mobile scroll:** multi-column tables must be wrapped in `<div className="table-scroll">` inside the shell. This allows horizontal scrolling on narrow viewports while `table-shell` preserves its border-radius clip.

```jsx
<div className="table-shell">
  <div className="table-shell-header">My table</div>
  <div className="table-scroll">          {/* ← required for mobile */}
    <table className="w-full text-sm">…</table>
  </div>
</div>
```

Never wrap the `table-shell-header` inside `table-scroll` — headers should stay anchored, only the table body scrolls.

### 3.10 `<Sparkline>` (`components/ui/Sparkline.tsx`)

Tiny inline trend line for stat cards. Pure SVG, no client JS, `aria-hidden`
(the headline number + delta carry meaning for assistive tech). Props:
`points: number[]`, optional `width`/`height`/`stroke` (defaults to
`var(--viz-spark)`). Renders nothing for fewer than 2 points.

### 3.11 `<TrendPill>` (`components/ui/TrendPill.tsx`)

Directional delta indicator: up/down/flat arrow (inline SVG, never emoji) + the
change value, colored by whether the change is *good* — not merely *up*. For
most metrics up == good; pass `good={false}` when up is bad (e.g. junk-consult
rate). Props: `value`, `direction: "up"|"down"|"flat"`, `good?`, `label?`.

### 3.12 `<StatHero>` (`components/StatHero.tsx`)

The ONE dominant metric on a dashboard (see §5.2). Accent icon chip + 4xl
number + `<TrendPill>` delta + breakdown line + optional `<Sparkline>`. Use
exactly once per dashboard; every other metric is a compact `<Stat>`.

### 3.9 Icons

A 1px-stroke, 24px Lucide-style set lives in `components/icons/`. Export each icon as a React component — no SVG strings in pages. Common icons: `Lock`, `Folder`, `CheckCircle`, `ArrowRight`, `Spinner`, `User`, `Shield`. The 📋 logo emoji is replaced by `PetitionMark` — a single SVG component used everywhere the brand mark appears.

---

## 4. Page anatomy

Every page lives inside the global `<main className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10">` declared in `app/layout.tsx`. **Pages do not declare their own max-width except for narrow content blocks.**

```
Page heading block      space-y-6, page-title font-display text-3xl
Section heading block   space-y-4, section-title font-display text-xl
Body block              space-y-3 (paragraphs) or space-y-2 (lists)
```

Wizard / funnel pages use `<div className="mx-auto max-w-prose py-8">` to constrain reading width to ~672px.

Dashboard pages use the full `max-w-content` with a mobile-first stat grid:

```jsx
{/* 1 col → 2 col at sm → 4 col at lg */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <Stat … />
</div>

{/* 1 col → 3 col at sm */}
<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
  …
</div>
```

### 4.1 Navigation

The `<nav>` in `app/layout.tsx` is split into two zones:

| Zone | Visibility | Contents |
|---|---|---|
| **Nav links** | `hidden md:flex` — hidden on mobile | Role-specific page links (admin, attorney) |
| **User info** | Always visible | Profile link (hidden sm), role badge, LogoutButton |

**On phones** users see: logo + role badge + sign-out button only. Navigation happens via in-page links, not the header nav. A hamburger drawer is a Phase 5 enhancement.

Role nav link groups must be wrapped: `<div className="hidden md:flex items-center gap-5">…</div>`. Never add individual `hidden md:inline` to each link — wrap the group.

---

## 5. Patterns

### 5.1 Stepped wizard (`/check`, `/cases/[id]/intake`)

- Wizard shell is `.card-lg`.
- Progress bar is `.progress` (height 4px, `--brand-primary` fill).
- Step dots are `.step-dot` (8 dots → uses one component).
- Footer always has back/next pair (back is `.btn-ghost`, next is `.btn-primary`).
- The data-loading state for "next" is required on every step.

### 5.2 Stat card row (dashboards)

Pure component: `<Stat label="…" value={123} … />`. Never inline metric cards.

`<Stat>` props (all optional except `label`/`value`, backward-compatible):
`sub`, `href`, `warn` (legacy → `tone="warning"`), `icon` (an icon component),
`delta` (`{ value, direction, good?, label? }` → renders a `<TrendPill>`),
`spark` (`number[]` → renders a `<Sparkline>`, replaces `sub` when both set),
`tone` (`"default"|"accent"|"success"|"warning"|"danger"`).

**Dashboard hierarchy rule:** promote exactly one metric to `<StatHero>` (§3.12);
keep the rest as compact `<Stat>` cards. Never render a row of equal-weight big
numbers — without a focal point the dashboard reads as lifeless. Every metric
that *can* show a period-over-period `delta` should.

### 5.3 Tier hero block (assessment results)

The hero on `/check` results and `/check/result/[leadId]` is a single component `<TierHero result={r} />`. The component owns color, icon, badge, and copy logic. **Pages no longer branch on tier.**

### 5.4 Form field

```
<Field label="Email" required error={errors.email}>
  <input type="email" className="input" {...register('email')} />
</Field>
```

The `Field` component renders the label, hint, required asterisk, and error message. Pages never re-render that scaffolding.

---

## 6. Score & tier — single source of truth

All threshold logic moves to `lib/scoring.ts`:

```ts
export type Tier = 'strong' | 'developing' | 'early';

export const TIER_THRESHOLDS = { strong: 70, developing: 45 } as const;

export function tierFor(score: number): Tier {
  if (score >= TIER_THRESHOLDS.strong) return 'strong';
  if (score >= TIER_THRESHOLDS.developing) return 'developing';
  return 'early';
}

export const TIER_META: Record<Tier, { label: string; longLabel: string; statusToken: 'success' | 'warning' | 'neutral'; icon: 'check-circle' | 'arrow-right' | 'arrow-up-right' }> = {
  strong:     { label: 'Strong',     longLabel: 'Strong Candidate',     statusToken: 'success', icon: 'check-circle' },
  developing: { label: 'Developing', longLabel: 'Developing Case',      statusToken: 'warning', icon: 'arrow-right' },
  early:      { label: 'Early',      longLabel: 'Early-Stage Case',     statusToken: 'neutral', icon: 'arrow-up-right' },
};
```

Legacy DB values (`tier1`/`tier2`/`tier3`) get mapped at the data-access layer in `lib/db.ts`, not in pages. **No page imports `tier1` directly.**

Letter quality has its own helper `letterQualityFor(score)` returning `'excellent' | 'acceptable' | 'needs-work'` — separate from candidate tier, with its own thresholds documented in the same file.

---

## 7. Accessibility floor (WCAG 2.1 AA)

| Requirement | Implementation |
|---|---|
| Color contrast 4.5:1 body, 3:1 large | All semantic text tokens pass against their surface tokens. Audited in `scripts/check-contrast.ts` (CI). |
| Focus visible | `.btn` and `.field` include `:focus-visible` outline (3px, `--focus-ring`). |
| Target size 44×44 | `.btn` and `.btn-sm` both meet the floor via min-h. `.btn-xs` is forbidden in production paths. |
| Form labels | Every `.input` has an associated `<label htmlFor>` via `<Field>`. |
| Error messaging | `aria-invalid="true"` on the input, `aria-describedby` linking to `.field-error-msg`. |
| Skip link | `<a className="skip-link">` first child of `<body>` (added in `layout.tsx`). |
| Reduced motion | All transitions wrapped in `motion-safe:`. |
| Live regions | Toasts/alerts that appear async use `role="status"` (polite) or `role="alert"` (assertive). |
| Keyboard | Modal traps focus, Escape closes. `<details>` for disclosure unless aria pattern is required. |

Run `pnpm lint:a11y` (eslint-plugin-jsx-a11y) before every PR.

---

## 8. Theming — how to swap palette or fonts

### 8.1 File layout

```
styles/
  themes/
    default.css      ← the v1 stone-based theme (matches current production look)
    warm.css         ← optional accent palette (proposed: muted gold + ink)
    dark.css         ← proposed dark mode
    high-contrast.css← proposed WCAG AAA variant
  globals.css        ← imports the active theme, defines component classes
```

### 8.2 Swapping a palette

A theme file *only* assigns the semantic layer:

```css
/* styles/themes/warm.css */
:root {
  --surface-canvas:    #faf6ef;
  --surface-card:      #ffffff;
  --surface-muted:     #f3ebdb;
  --surface-inverted:  #1a1815;

  --text-primary:      #1a1815;
  --text-secondary:    #5a5345;
  --text-muted:        #968a72;

  --brand-primary:     #8a6a2f;
  --brand-primary-hover:#6a4f1e;
  --brand-on-primary:  #ffffff;

  /* status family + radii + shadow tokens unchanged */
}
```

To switch the app theme: change the import line in `app/globals.css`:

```css
/* before */
@import './themes/default.css';
/* after */
@import './themes/warm.css';
```

That is the entire migration. No component file changes, no JSX changes.

### 8.3 Multi-theme via attribute (future)

For dark mode or per-user themes, themes can be scoped to a `data-theme` attribute on `<html>`:

```css
[data-theme="dark"] { … }
[data-theme="high-contrast"] { … }
```

`layout.tsx` reads a cookie or user preference and sets `<html data-theme={theme}>`. Tokens cascade automatically.

### 8.4 Swapping fonts

Fonts move from a `@import url()` in `globals.css` to `next/font/google` in `app/layout.tsx`:

```tsx
import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';

const display = Fraunces({ subsets: ['latin'], variable: '--font-display' });
const body    = Inter   ({ subsets: ['latin'], variable: '--font-body' });
const mono    = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
```

To change the display font: swap `Fraunces` for `Playfair_Display` (or any Google font). To change the body font: swap `Inter`. No other file changes. `next/font` self-hosts — no Google CDN ping, no CLS, GDPR-friendlier.

---

## 8.5 Verification badges

Verification status badges on lead cards and detail views use `.badge` with status modifiers:

| Claim status | Rendering |
|---|---|
| `verified` | `.badge.badge-success` — green pill |
| `self_reported` | `.badge.badge-warning` — amber pill |
| `contradicted` | `.badge.badge-danger` — red pill |
| `not_found` | `.badge.badge-neutral` — gray pill |

Trust score chip uses the same color logic:

| Score range | Color |
|---|---|
| 80–100 | `text-success-text bg-success-bg` |
| 60–79 | `text-warning-text bg-warning-bg` |
| 0–59 | `text-danger-text bg-danger-bg` |

Files:
- `components/leads/VerificationDetails.tsx` — per-claim provenance table (server component)
- Lead card badges rendered inline in `app/network/leads/page.tsx`
- Trust score chip on lead detail page `app/leads/[id]/page.tsx`

---

## 9. How to add a new component

1. **Check this file first.** If the need overlaps with an existing primitive (`.card`, `.btn`, `.badge`, `.alert`, `.empty-state`, `.table-*`, `.score-meter`), use it. Compose, don't fork.
2. **Propose the addition here before writing code.** Open a PR that *only* updates this file with the new component's API. Get explicit sign-off.
3. **Implement in `globals.css` (utility-composed) or `components/ui/` (React).** Never in a page file.
4. **Add at least one usage in the codebase.** Unused primitives rot.
5. **Document states**: default, hover, focus-visible, active, disabled, loading, error.
6. **Run `pnpm typecheck && pnpm lint && pnpm test`.**

---

## 10. Anti-patterns (forbidden)

```jsx
// ❌ raw color
<div className="bg-stone-50 text-stone-900">…</div>

// ✅ semantic
<div className="bg-surface-canvas text-text-primary">…</div>

// ❌ inline radius + border + shadow
<div className="rounded-xl border border-stone-200 bg-white px-6 py-5 shadow-sm">…</div>

// ✅ card primitive
<div className="card">…</div>

// ❌ inline button
<button className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">Save</button>

// ✅ btn primitive
<button className="btn btn-primary">Save</button>

// ❌ inline tier color map (duplicate of 4 others)
const TIER_BADGE = { tier1: 'bg-green-100 text-green-800', … }

// ✅ centralized
const { statusToken, label } = TIER_META[tierFor(score)];
<span className={`badge badge-${statusToken}`}>{label}</span>

// ❌ emoji icon
<span className="text-2xl">📋</span>

// ✅ icon component
<PetitionMark className="h-6 w-6" />

// ❌ arbitrary value
<div className="p-[18px] mt-[7px]">…</div>

// ✅ scale value
<div className="p-4 mt-2">…</div>

// ❌ focus removed
<input className="focus:outline-none" />

// ✅ focus preserved (input class includes :focus-visible by default)
<input className="input" />

// ❌ fixed grid — breaks at 375px (3 cols = ~110px each, unreadable)
<div className="grid grid-cols-3 gap-4">…</div>

// ✅ mobile-first grid
<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">…</div>

// ❌ table with no scroll wrapper — overflows off-screen on phones
<div className="table-shell">
  <table className="w-full text-sm">…</table>
</div>

// ✅ table with scroll wrapper
<div className="table-shell">
  <div className="table-scroll">
    <table className="w-full text-sm">…</table>
  </div>
</div>

// ❌ nav links always visible — overflows on 375px with 5+ links
<nav className="flex items-center gap-6">
  <Link href="/admin">Dashboard</Link>
  <Link href="/cases">Cases</Link>
  …
</nav>

// ✅ nav links hidden on mobile
<nav className="flex items-center gap-3">
  <div className="hidden md:flex items-center gap-5">
    <Link href="/admin">Dashboard</Link>
    <Link href="/cases">Cases</Link>
  </div>
  {/* user info always visible */}
</nav>
```

---

## 11. Migration phases (informational — for project plan only)

| Phase | Scope | Touches production | Reversible |
|---|---|---|---|
| **0 — Tokens + DESIGN.md** | This file + `styles/themes/default.css` + updated `globals.css` + `tailwind.config.ts` aliases | No visual change | Trivial |
| **1 — `/check` funnel** | Migrate the highest-traffic surface first; consolidate `TierHero`, `ScoreRing`, wizard cards | Visual parity, internal cleanup | One revert |
| **2 — Dashboards** | `admin/page.tsx`, `network/dashboard/page.tsx`, `admin/leads/page.tsx` — adopt `Stat`, `.table-*` | Visual parity | Per-page revert |
| **3 — Case workspace** | `cases/[id]/page.tsx`, `LetterEditor`, intake wizards | Visual parity | Per-page revert |
| **4 — A11y CI + token lint** | `eslint-plugin-tailwindcss` config blocks raw color classes outside theme files; `scripts/check-contrast.ts` runs on PR | None | n/a |
| **5 — Dark mode + alt theme** | Ship `data-theme="dark"`; user preference toggle | New surface | Feature flag |

---

## 12. Responsive design rules

The app targets **375px** (iPhone SE) as the smallest supported viewport. The Tailwind breakpoint ladder:

| Prefix | Min-width | Target |
|---|---|---|
| *(none)* | 0px | Phones (375px+) |
| `sm:` | 640px | Large phones, small tablets |
| `md:` | 768px | Tablets, nav breakpoint |
| `lg:` | 1024px | Laptops, desktop dashboards |
| `xl:` | 1280px | Wide desktop |

### 12.1 Grid checklist

Before committing any grid layout, verify:

- [ ] Base value is `grid-cols-1` (no prefix) — stacks on phones
- [ ] `sm:` variant for tablet step-up (if needed)
- [ ] `lg:` variant for desktop (if 4-column stat rows)
- [ ] No `grid-cols-2`, `grid-cols-3`, or `grid-cols-4` without a `grid-cols-1` base

### 12.2 Table checklist

- [ ] Outer `<div className="table-shell">` wraps the whole thing
- [ ] Inner `<div className="table-scroll">` wraps **only** the `<table>` (not shell-headers)
- [ ] If hiding columns on mobile, use `hidden sm:table-cell` on `<th>` + matching `<td>`

### 12.3 Nav rules

- Role-specific nav links: `<div className="hidden md:flex …">` — one wrapper per role group, never per-link
- User info strip: always visible, but name is `hidden sm:inline` to save space on xs
- "Check eligibility" CTA: always visible (it's the only nav for unauthenticated users)
- Hamburger drawer: not yet implemented — Phase 5 work item

### 12.4 Touch targets

All interactive elements must meet 44×44px minimum on mobile. `.btn` and `.btn-sm` meet this by default. Custom clickable elements must add `min-h-[44px] min-w-[44px]`.

### 12.5 Spacing on mobile

- Page-level padding: `px-4 py-8 sm:px-6 sm:py-10` (set in layout, do not override)
- Card padding: `.card` = 1.5rem (24px) — acceptable on mobile (leaves ~327px content width at 375px)
- `.card-lg` = 2rem (32px) — tight on mobile; funnel pages are centered at `max-w-prose` so this is fine
- Gap between grid items: `gap-3` on mobile grids (not `gap-4`) to preserve breathing room

---

## 13. Glossary (legacy terminology → new)

| Old in code today | New canonical | Where the rewrite happens |
|---|---|---|
| `tier1` / `tier2` / `tier3` | `'strong'` / `'developing'` / `'early'` | `lib/db.ts` boundary; UI sees only new |
| `Strong` / `Borderline` / `Weak` (`/check`) | same as above (tier system) | `lib/scoring.ts` |
| `Tier 1 — Strong (≥75)` (admin labels) | `TIER_META[tier].longLabel` | `admin/leads/page.tsx` |
| Letter quality `>= 85 / >= 70` thresholds | `letterQualityFor(score)` returning `'excellent' \| 'acceptable' \| 'needs-work'` | `lib/scoring.ts` (separate from candidate tier) |
| `STATUS_STYLE` map in `admin/page.tsx` | `.badge` + status modifier | `globals.css` |

---

## 14. References

- W3C Design Tokens Community Group spec — `https://design-tokens.github.io/community-group/format/`
- WCAG 2.1 AA quick reference — `https://www.w3.org/WAI/WCAG21/quickref/`
- Radix UI accessibility patterns (we follow these even without using the library) — `https://www.radix-ui.com/primitives`
- Tailwind theme extension — `https://tailwindcss.com/docs/theme`

---

**Last updated:** 2026-05-17 — responsive design rules added (Rule 11, §4.1 nav, §3.8 table-scroll, §12, anti-patterns); page padding made responsive.
**Owners:** Adel Gasmi (product), any agent who edits UI (mechanically enforced via this file).
