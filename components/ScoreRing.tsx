import { TIER_META, type Tier } from "@/lib/scoring";

const RING_COLOR: Record<Tier, string> = {
  strong:     "var(--status-success-fill)",
  developing: "var(--status-warning-fill)",
  early:      "var(--status-danger-fill)",
};

const TEXT_CLASS: Record<Tier, string> = {
  strong:     "text-success-text",
  developing: "text-warning-text",
  early:      "text-danger-text",
};

/**
 * R-1: the center shows the score BAND, not the raw integer. The exact number
 * is near-deterministic but still carries false precision (a re-assessment
 * shifting 73→72 reads as instability); the band is the honest resolution.
 * The ring fill still uses the exact score, where ±1 is invisible.
 */
export function ScoreRing({ score, tier }: { score: number; tier: Tier }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(Math.max(score, 0), 100) / 100 * circ;
  const color = RING_COLOR[tier];

  return (
    <div className="relative flex h-32 w-32 shrink-0 items-center justify-center">
      <svg className="-rotate-90" width="128" height="128" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" stroke="var(--border-default)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r}
          fill="none"
          style={{ stroke: color }}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className={`text-2xl font-bold tabular-nums ${TEXT_CLASS[tier]}`}>{TIER_META[tier].range}</div>
        <div className="text-xs text-text-muted">score band</div>
      </div>
    </div>
  );
}
