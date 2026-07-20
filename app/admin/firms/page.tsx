"use client";

import { useState, useEffect, useCallback } from "react";

type Firm = {
  id: string;
  userId: string;
  firmName: string | null;
  networkTier: string;
  subscriptionStatus: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  specialties: string[];
  calendlyUrl: string | null;
  createdAt: string;
  updatedAt: string;
  attorney: {
    id: string;
    name: string;
    email: string;
    verified: boolean;
    suspended: boolean;
    createdAt: string;
    userSubscriptionStatus: string | null;
    claimedLeads: number;
    activeCases: number;
  };
};

const TIER_STYLE: Record<string, string> = {
  pilot:    "bg-info-soft text-info-text",
  standard: "bg-surface-muted text-text-secondary",
  premium:  "bg-warning-soft text-warning-text",
};

const SUB_STYLE: Record<string, string> = {
  active:   "bg-success-soft text-success-text",
  trialing: "bg-info-soft text-info-text",
  past_due: "bg-danger-soft text-danger-text",
  canceled: "bg-surface-muted text-text-muted",
};

export default function FirmsPage() {
  const [firms, setFirms] = useState<Firm[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/firms");
    if (res.ok) setFirms(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAction = async (firmId: string, action: string, extra?: Record<string, string>) => {
    setActing(firmId);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/firms/${firmId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Action failed" });
      } else {
        setMessage({ type: "success", text: `Done: ${data.action}` });
        load();
      }
    } catch {
      setMessage({ type: "error", text: "Network error" });
    }
    setActing(null);
  };

  const activeFirms = firms.filter((f) => !f.attorney.suspended);
  const suspendedFirms = firms.filter((f) => f.attorney.suspended);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl tracking-tight">Firms</h1>
        <p className="mt-1 text-sm text-text-secondary">
          {firms.length} firm{firms.length !== 1 ? "s" : ""} registered
          {suspendedFirms.length > 0 && (
            <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-text">
              {suspendedFirms.length} suspended
            </span>
          )}
        </p>
      </div>

      {message && (
        <div className={`rounded border px-4 py-3 text-sm ${
          message.type === "success"
            ? "border-success-border bg-success-bg text-success-text"
            : "border-danger-border bg-danger-bg text-danger-text"
        }`}>
          {message.text}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-text-muted">Loading firms…</p>
      ) : firms.length === 0 ? (
        <div className="empty-state"><p className="empty-state-title">No firms registered yet</p></div>
      ) : (
        <div className="space-y-4">
          {/* Active firms */}
          {activeFirms.map((f) => (
            <FirmCard key={f.id} firm={f} acting={acting} onAction={doAction} />
          ))}

          {/* Suspended firms */}
          {suspendedFirms.length > 0 && (
            <>
              <div className="flex items-center gap-3 pt-4">
                <div className="h-px flex-1 bg-border-subtle" />
                <span className="text-xs font-medium uppercase tracking-wider text-text-muted">Suspended</span>
                <div className="h-px flex-1 bg-border-subtle" />
              </div>
              {suspendedFirms.map((f) => (
                <FirmCard key={f.id} firm={f} acting={acting} onAction={doAction} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function FirmCard({
  firm: f,
  acting,
  onAction,
}: {
  firm: Firm;
  acting: string | null;
  onAction: (id: string, action: string, extra?: Record<string, string>) => void;
}) {
  const isBusy = acting === f.id;
  const sub = f.subscriptionStatus ?? f.attorney.userSubscriptionStatus;

  return (
    <div className={`card p-0 overflow-hidden ${f.attorney.suspended ? "opacity-60" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3 border-b border-border-subtle">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-text-primary">
              {f.firmName ?? "Unnamed firm"}
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TIER_STYLE[f.networkTier] ?? TIER_STYLE.standard}`}>
              {f.networkTier}
            </span>
            {f.attorney.suspended && (
              <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-text">
                suspended
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-text-muted">
            {f.attorney.name} · {f.attorney.email}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {sub && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SUB_STYLE[sub] ?? "bg-surface-muted text-text-secondary"}`}>
              {sub}
            </span>
          )}
          {!sub && f.networkTier !== "pilot" && (
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-muted">
              no subscription
            </span>
          )}
        </div>
      </div>

      {/* Stats + Actions */}
      <div className="flex items-center justify-between gap-4 px-5 py-3">
        {/* Stats */}
        <div className="flex items-center gap-6 text-xs text-text-secondary">
          <div>
            <span className="font-medium text-text-primary">{f.attorney.claimedLeads}</span> {f.attorney.claimedLeads === 1 ? "lead" : "leads"} claimed
          </div>
          <div>
            <span className="font-medium text-text-primary">{f.attorney.activeCases}</span> active {f.attorney.activeCases === 1 ? "case" : "cases"}
          </div>
          <div>
            Joined {new Date(f.createdAt).toLocaleDateString()}
          </div>
          {f.attorney.verified ? (
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success-fill" />
              verified
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning-fill" />
              unverified
            </div>
          )}
          {f.specialties.length > 0 && (
            <div className="hidden lg:block truncate max-w-[200px]" title={f.specialties.join(", ")}>
              {f.specialties.join(", ")}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Tier selector */}
          <select
            className="rounded border border-border-default bg-bg-primary px-2 py-1 text-xs text-text-primary"
            value={f.networkTier}
            disabled={isBusy}
            onChange={(e) => {
              if (e.target.value !== f.networkTier) {
                onAction(f.id, "set-tier", { tier: e.target.value });
              }
            }}
          >
            <option value="standard">Standard</option>
            <option value="pilot">Pilot</option>
            <option value="premium">Premium</option>
          </select>

          {f.attorney.suspended ? (
            <button
              className="rounded bg-success-fill px-3 py-1 text-xs font-medium text-white hover:bg-success-fill disabled:opacity-50"
              disabled={isBusy}
              onClick={() => {
                if (confirm(`Re-enable access for ${f.firmName ?? f.attorney.name}?`)) {
                  onAction(f.id, "unsuspend");
                }
              }}
            >
              {isBusy ? "…" : "Unsuspend"}
            </button>
          ) : (
            <button
              className="rounded bg-danger-bg px-3 py-1 text-xs font-medium text-danger-text hover:bg-danger-soft disabled:opacity-50"
              disabled={isBusy}
              onClick={() => {
                if (confirm(`Suspend ${f.firmName ?? f.attorney.name}? This will immediately revoke their session and block login.`)) {
                  onAction(f.id, "suspend");
                }
              }}
            >
              {isBusy ? "…" : "Suspend"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
