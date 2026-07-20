/**
 * Sparkline — a tiny inline trend line for stat cards (DESIGN.md §3.10).
 *
 * Pure SVG, no client JS. Renders a normalized polyline from a numeric series.
 * Decorative by default (aria-hidden) — the headline number + delta carry the
 * meaning for assistive tech. Stroke defaults to the data-viz accent token.
 */
type Props = {
  points: number[];
  width?: number;
  height?: number;
  /** CSS color or token, e.g. "var(--viz-spark)" (default) or "var(--viz-positive)". */
  stroke?: string;
  className?: string;
};

export function Sparkline({
  points,
  width = 120,
  height = 32,
  stroke = "var(--viz-spark)",
  className,
}: Props) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  // Inset by 1px top/bottom so the 2px stroke never clips at the extremes.
  const usable = height - 2;

  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = 1 + (usable - ((p - min) / span) * usable);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
