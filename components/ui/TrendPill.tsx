/**
 * TrendPill — a directional delta indicator for dashboards (DESIGN.md §3.11).
 *
 * Shows an up/down/flat arrow + the change value, colored by whether the change
 * is *good* (not merely *up*). For most metrics up == good, but pass `good`
 * explicitly when up is bad (e.g. junk-consult rate). Pure, no client JS; the
 * arrow is an inline SVG glyph (never an emoji — DESIGN.md rule 6).
 */
type Direction = "up" | "down" | "flat";

type Props = {
  /** The change to display, e.g. "+12", "4 pts", "faster". */
  value: string | number;
  direction: Direction;
  /** Override semantics: true = green, false = red. Defaults to (direction === "up"). */
  good?: boolean;
  /** Trailing context, e.g. "vs prior 30d". Rendered muted. */
  label?: string;
  className?: string;
};

function Arrow({ direction }: { direction: Direction }) {
  if (direction === "flat") {
    return (
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d="M1 5h8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  const up = direction === "up";
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path
        d={up ? "M5 1.5 L8.5 6 H1.5 Z" : "M5 8.5 L8.5 4 H1.5 Z"}
        fill="currentColor"
      />
    </svg>
  );
}

export function TrendPill({ value, direction, good, label, className }: Props) {
  const isGood = good ?? direction === "up";
  const tone =
    direction === "flat"
      ? "text-text-muted"
      : isGood
      ? "text-success-text"
      : "text-danger-text";

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${tone} ${className ?? ""}`}>
      <Arrow direction={direction} />
      <span className="tabular-nums">{value}</span>
      {label && <span className="font-normal text-text-muted">{label}</span>}
    </span>
  );
}
