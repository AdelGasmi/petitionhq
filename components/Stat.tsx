import Link from "next/link";
import { Sparkline } from "./ui/Sparkline";
import { TrendPill } from "./ui/TrendPill";

/**
 * Stat — a compact dashboard metric card (DESIGN.md §5.2).
 *
 * Backward-compatible: the original `label`/`value`/`sub`/`href`/`warn` API still
 * works untouched. New optional props add life: an icon, a directional delta,
 * a tone accent, and a sparkline.
 */
type Delta = {
  value: string | number;
  direction: "up" | "down" | "flat";
  good?: boolean;
  label?: string;
};

type Tone = "default" | "accent" | "success" | "warning" | "danger";

type Props = {
  label: string;
  value: string | number;
  /** Secondary line below value */
  sub?: string;
  /** Makes the card a clickable link */
  href?: string;
  /** Legacy: warning surface + colors. Equivalent to tone="warning". */
  warn?: boolean;
  /** Icon component, e.g. <Users className="h-4 w-4" />. */
  icon?: React.ReactNode;
  /** Directional change indicator. */
  delta?: Delta;
  /** Numeric series for an inline sparkline (replaces `sub` when both given). */
  spark?: number[];
  /** Visual tone. `warn` maps to "warning". */
  tone?: Tone;
};

const TONE_CARD: Record<Tone, string> = {
  default: "",
  accent: "border-accent-border",
  success: "border-success-border",
  warning: "border-warning-border bg-warning-bg",
  danger: "border-danger-border",
};

const TONE_LABEL: Record<Tone, string> = {
  default: "text-text-secondary",
  accent: "text-accent-text",
  success: "text-success-text",
  warning: "text-warning-text",
  danger: "text-danger-text",
};

function StatContent({ label, value, sub, warn, icon, delta, spark, tone }: Omit<Props, "href">) {
  const t: Tone = tone ?? (warn ? "warning" : "default");
  return (
    <div className={`card space-y-1.5 ${TONE_CARD[t]}`}>
      <div className={`flex items-center gap-1.5 text-xs font-medium ${TONE_LABEL[t]}`}>
        {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${t === "warning" ? "text-warning-text" : "text-text-primary"}`}>
          {value}
        </span>
        {delta && <TrendPill {...delta} />}
      </div>
      {spark && spark.length > 1 ? (
        <Sparkline points={spark} width={120} height={28} className="w-full" />
      ) : (
        sub && <div className="text-xs text-text-muted">{sub}</div>
      )}
    </div>
  );
}

export function Stat({ href, ...rest }: Props) {
  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        <StatContent {...rest} />
      </Link>
    );
  }
  return <StatContent {...rest} />;
}
