import Link from "next/link";
import { Sparkline } from "./ui/Sparkline";
import { TrendPill } from "./ui/TrendPill";

/**
 * StatHero — the ONE dominant metric on a dashboard (DESIGN.md §5.2).
 *
 * Establishes hierarchy: a single hero metric the eye lands on first, with an
 * accent icon chip, a large number, a directional delta, an optional breakdown
 * line, and an optional sparkline. Use exactly once per dashboard; everything
 * else is a compact <Stat>.
 */
type Delta = {
  value: string | number;
  direction: "up" | "down" | "flat";
  good?: boolean;
  label?: string;
};

type Props = {
  label: string;
  value: string | number;
  /** An icon component from components/icons, e.g. <Users className="h-6 w-6" />. */
  icon?: React.ReactNode;
  delta?: Delta;
  /** Short breakdown line, e.g. "4 strong · 32 developing · 17 early". */
  sub?: string;
  /** Numeric series for the trailing sparkline. */
  spark?: number[];
  href?: string;
};

function Inner({ label, value, icon, delta, sub, spark }: Omit<Props, "href">) {
  return (
    <div className="card flex items-center gap-5 border-accent-border">
      {icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent-bg text-accent-text">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm text-text-secondary">{label}</div>
        <div className="flex items-baseline gap-3">
          <span className="text-4xl font-semibold tabular-nums text-text-primary leading-tight">{value}</span>
          {delta && <TrendPill {...delta} />}
        </div>
        {sub && <div className="mt-0.5 text-xs text-text-muted">{sub}</div>}
      </div>
      {spark && spark.length > 1 && (
        <Sparkline points={spark} width={150} height={44} className="hidden shrink-0 sm:block" />
      )}
    </div>
  );
}

export function StatHero({ href, ...rest }: Props) {
  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-80">
        <Inner {...rest} />
      </Link>
    );
  }
  return <Inner {...rest} />;
}
