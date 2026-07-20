import { BRAND } from "@/lib/seo";

export function BetaBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-secondary">
      <span>
        <strong className="text-text-primary">Self-petitioner beta</strong> · document preparation software, not
        legal advice.
      </span>
      <a href={`mailto:${BRAND.founderEmail}?subject=Beta feedback`} className="text-text-primary underline hover:no-underline">
        Beta feedback
      </a>
    </div>
  );
}
