import type { Config } from "tailwindcss";

/**
 * PetitionHQ Tailwind config.
 *
 * Semantic tokens (defined in styles/themes/default.css) are exposed as
 * Tailwind utilities. Components should consume the semantic aliases
 * (`bg-surface-card`, `text-text-primary`, `border-border-default`,
 * `bg-success-bg`, etc.) — NOT the raw Tailwind palette classes.
 *
 * Backward-compat: the raw Tailwind color palette (`bg-stone-50`, etc.) is
 * still available by default. Existing code keeps working. New code should
 * use the semantic aliases declared below. See DESIGN.md §1 rule 2.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces
        "surface-canvas":   "var(--surface-canvas)",
        "surface-card":     "var(--surface-card)",
        "surface-muted":    "var(--surface-muted)",
        "surface-subtle":   "var(--surface-subtle)",
        "surface-inverted": "var(--surface-inverted)",

        // Text
        "text-primary":   "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "text-muted":     "var(--text-muted)",
        "text-disabled":  "var(--text-disabled)",
        "text-inverted":  "var(--text-inverted)",

        // Borders — exposed as both `border-*` and as colors for utility use
        "border-subtle":   "var(--border-subtle)",
        "border-default":  "var(--border-default)",
        "border-strong":   "var(--border-strong)",
        "border-inverted": "var(--border-inverted)",

        // Brand
        "brand-primary":       "var(--brand-primary)",
        "brand-primary-hover": "var(--brand-primary-hover)",
        "brand-on-primary":    "var(--brand-on-primary)",

        // Status — each nested so `bg-success-bg`, `text-success-text`, etc.
        success: {
          DEFAULT: "var(--status-success-fill)",
          bg:      "var(--status-success-bg)",
          border:  "var(--status-success-border)",
          text:    "var(--status-success-text)",
          fill:    "var(--status-success-fill)",
          soft:    "var(--status-success-soft)",
        },
        warning: {
          DEFAULT: "var(--status-warning-fill)",
          bg:      "var(--status-warning-bg)",
          border:  "var(--status-warning-border)",
          text:    "var(--status-warning-text)",
          fill:    "var(--status-warning-fill)",
          soft:    "var(--status-warning-soft)",
        },
        danger: {
          DEFAULT: "var(--status-danger-fill)",
          bg:      "var(--status-danger-bg)",
          border:  "var(--status-danger-border)",
          text:    "var(--status-danger-text)",
          fill:    "var(--status-danger-fill)",
          soft:    "var(--status-danger-soft)",
        },
        info: {
          DEFAULT: "var(--status-info-fill)",
          bg:      "var(--status-info-bg)",
          border:  "var(--status-info-border)",
          text:    "var(--status-info-text)",
          fill:    "var(--status-info-fill)",
          soft:    "var(--status-info-soft)",
        },
        verify: {
          DEFAULT: "var(--verify-fill)",
          bg:      "var(--verify-bg)",
          border:  "var(--verify-border)",
          text:    "var(--verify-text)",
          fill:    "var(--verify-fill)",
          soft:    "var(--verify-soft)",
        },
        // Accent — product color identity (not a status). DESIGN.md §2.7.
        accent: {
          DEFAULT: "var(--accent-fill)",
          bg:      "var(--accent-bg)",
          border:  "var(--accent-border)",
          text:    "var(--accent-text)",
          fill:    "var(--accent-fill)",
          soft:    "var(--accent-soft)",
        },
        // Data-viz — direction/magnitude encoding for charts + deltas.
        viz: {
          positive: "var(--viz-positive)",
          negative: "var(--viz-negative)",
          track:    "var(--viz-track)",
          spark:    "var(--viz-spark)",
        },
      },
      fontFamily: {
        // New canonical names
        display: ["var(--font-display)", "Georgia", "serif"],
        body:    ["var(--font-body)",    "system-ui", "sans-serif"],
        mono:    ["var(--font-mono)",    "monospace"],
        // Backward-compat — existing code uses font-serif / font-sans
        serif: ["var(--font-display)", "Georgia", "serif"],
        sans:  ["var(--font-body)",    "system-ui", "sans-serif"],
      },
      fontSize: {
        // Override Tailwind defaults to read from tokens
        xs:   ["var(--text-xs)",   { lineHeight: "1.4"  }],
        sm:   ["var(--text-sm)",   { lineHeight: "1.45" }],
        base: ["var(--text-base)", { lineHeight: "1.55" }],
        lg:   ["var(--text-lg)",   { lineHeight: "1.4"  }],
        xl:   ["var(--text-xl)",   { lineHeight: "1.35" }],
        "2xl":["var(--text-2xl)",  { lineHeight: "1.3"  }],
        "3xl":["var(--text-3xl)",  { lineHeight: "1.2"  }],
        "4xl":["var(--text-4xl)",  { lineHeight: "1.15" }],
        "5xl":["var(--text-5xl)",  { lineHeight: "1.1"  }],
      },
      borderRadius: {
        sm:   "var(--radius-sm)",
        md:   "var(--radius-md)",
        lg:   "var(--radius-lg)",
        xl:   "var(--radius-xl)",
        "2xl":"var(--radius-2xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs:    "var(--shadow-xs)",
        sm:    "var(--shadow-sm)",
        md:    "var(--shadow-md)",
        lg:    "var(--shadow-lg)",
        focus: "var(--shadow-focus)",
      },
      maxWidth: {
        content: "var(--max-content)",
        prose:   "var(--max-prose)",
        narrow:  "var(--max-narrow)",
      },
      transitionDuration: {
        fast: "var(--duration-fast)",
        DEFAULT: "var(--duration-base)",
        slow: "var(--duration-slow)",
      },
      transitionTimingFunction: {
        "token-out":    "var(--ease-out)",
        "token-in-out": "var(--ease-in-out)",
      },
    },
  },
  plugins: [],
} satisfies Config;
