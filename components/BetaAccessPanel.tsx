import { BetaDeactivateButton } from "@/components/BetaDeactivateButton";

type Props = {
  userId: string;
  agreementAcceptedAt: string | null;
  costCents: number;
  capCents: number;
};

export function BetaAccessPanel({ userId, agreementAcceptedAt, costCents, capCents }: Props) {
  const pct = Math.min(100, Math.round((costCents / capCents) * 100));
  const barColor = pct >= 100 ? "bg-danger-fill" : pct >= 75 ? "bg-warning-fill" : "bg-success-fill";

  return (
    <div className="card space-y-3 text-sm">
      <h2 className="font-serif text-lg">Self-petitioner beta</h2>
      <div className="space-y-2 text-text-secondary">
        <div className="flex justify-between">
          <span className="text-text-muted">Agreement accepted</span>
          <span>{agreementAcceptedAt ? new Date(agreementAcceptedAt).toLocaleDateString() : "Not yet"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text-muted">LLM cost to date</span>
          <span className="tabular-nums">
            ${(costCents / 100).toFixed(2)} of ${(capCents / 100).toFixed(2)} cap
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <BetaDeactivateButton userId={userId} className="btn btn-danger text-xs" />
    </div>
  );
}
