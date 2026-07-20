import { type Tier, TIER_META } from "@/lib/scoring";
import { ScoreRing } from "@/components/ScoreRing";

const CONTAINER_CLASS: Record<Tier, string> = {
  strong:     "bg-success-bg border-success-border",
  developing: "bg-warning-bg border-warning-border",
  early:      "bg-surface-muted border-border-default",
};

const BADGE_CLASS: Record<Tier, string> = {
  strong:     "badge badge-strong badge-success",
  developing: "badge badge-strong badge-warning",
  early:      "badge badge-strong badge-neutral",
};

const TEXT_CLASS: Record<Tier, string> = {
  strong:     "text-success-text",
  developing: "text-warning-text",
  early:      "text-text-primary",
};

// Unicode directional icons — not emoji, safe cross-platform
const ICON: Record<Tier, string> = {
  strong:     "✓",
  developing: "→",
  early:      "↗",
};

type Props = {
  tier: Tier;
  /** When provided, shows the numeric ring (all tiers) */
  score?: number;
  summary: string;
  /** Overrides the default longLabel from TIER_META */
  badgeLabel?: string;
  /** Renders as a secondary pill next to the tier badge (e.g. "EB-2 via Advanced Degree") */
  pathLabel?: string;
  /** Any additional elements to render in the badge row */
  children?: React.ReactNode;
};

export function TierHero({ tier, score, summary, badgeLabel, pathLabel, children }: Props) {
  const { longLabel } = TIER_META[tier];
  const showRing = typeof score === "number";

  return (
    <div className={`rounded-2xl border px-8 py-8 ${CONTAINER_CLASS[tier]}`}>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        {showRing ? (
          <ScoreRing score={score!} tier={tier} />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-surface-card/80 shadow-sm">
            <span className="text-4xl" aria-hidden="true">{ICON[tier]}</span>
          </div>
        )}

        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span className={BADGE_CLASS[tier]}>{badgeLabel ?? longLabel}</span>
            {pathLabel && <span className="badge badge-neutral">{pathLabel}</span>}
            {children}
          </div>
          {/* Always left-aligned: the summary runs 8–14 lines on mobile, and
              centered long-form text is unreadable. Badges stay centered. */}
          <p className={`mt-3 text-sm leading-relaxed text-left ${TEXT_CLASS[tier]}`}>{summary}</p>
        </div>
      </div>
    </div>
  );
}

/** Resolve an EB-2 path slug to a human-readable label for the pathLabel prop */
export function eb2PathLabel(path: string | undefined): string | undefined {
  if (path === "advanced-degree") return "EB-2 via Advanced Degree";
  if (path === "exceptional-ability") return "EB-2 via Exceptional Ability";
  return undefined;
}
