"use client";

import { useState } from "react";

type ClaimPayment = {
  id: string;
  leadId: string;
  amountCents: number;
  status: string;
  createdAt: string;
};

type BillingData = {
  firmName: string | null;
  subscriptionStatus: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  claimPayments: ClaimPayment[];
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active:    { label: "Active",     color: "bg-success-soft text-success-text" },
  past_due:  { label: "Past due",   color: "bg-danger-soft text-danger-text" },
  canceled:  { label: "Canceled",   color: "bg-surface-muted text-text-secondary" },
  trialing:  { label: "Trial",      color: "bg-info-soft text-info-text" },
  unpaid:    { label: "Unpaid",     color: "bg-warning-soft text-warning-text" },
};

export function BillingClient({ data }: { data: BillingData }) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState(false);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string };
      if (json.url) window.location.href = json.url;
    } catch { /* best-effort */ }
    finally { setPortalLoading(false); }
  };

  const startSubscription = async () => {
    setSubscribeLoading(true);
    try {
      const res = await fetch("/api/billing/subscribe", { method: "POST" });
      const json = (await res.json()) as { checkoutUrl?: string };
      if (json.checkoutUrl) window.location.href = json.checkoutUrl;
    } catch { /* best-effort */ }
    finally { setSubscribeLoading(false); }
  };

  const statusInfo = STATUS_LABELS[data.subscriptionStatus ?? ""] ?? null;
  const completedClaims = data.claimPayments.filter(p => p.status === "completed");

  // Membership is active whenever the status says so (covers complimentary /
  // seeded accounts with no Stripe subscription on file). `isStripeManaged`
  // gates the "Manage subscription" portal button, which needs a real Stripe sub.
  const hasAccess = data.subscriptionStatus === "active";
  const isStripeManaged = data.hasSubscription && data.subscriptionStatus === "active";
  const isPastDue = data.subscriptionStatus === "past_due";
  const totalSpent = completedClaims.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-2xl tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Manage your plan and view payment history.
        </p>
      </div>

      {isPastDue && (
        <div className="rounded-xl border border-danger-border bg-danger-bg px-5 py-3 text-sm text-danger-text flex items-center justify-between">
          <span>Your payment failed. Update your payment method to keep marketplace access.</span>
          <button onClick={openPortal} disabled={portalLoading} className="btn btn-primary text-xs">
            {portalLoading ? "Loading..." : "Update payment"}
          </button>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-border-default bg-surface-subtle px-5 py-3 text-sm text-text-secondary">
        Membership gives you platform access and anonymized lead browsing. Claim fees unlock full applicant details and case conversion.
      </div>

      {/* Two-product pricing grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Product 1: Membership */}
        <div className={`card space-y-4 ${hasAccess ? "ring-2 ring-success-fill/30" : ""}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Membership</h2>
            {hasAccess ? (
              <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-text">Active</span>
            ) : statusInfo && data.subscriptionStatus !== "past_due" ? (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
            ) : null}
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-text-primary">$99</span>
              <span className="text-sm text-text-muted">/month</span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Access your attorney workspace &mdash; browse leads, draft letters, and manage cases.
            </p>
          </div>

          <ul className="space-y-1.5 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-success-text">&#10003;</span>
              Browse anonymized pre-qualified leads
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-success-text">&#10003;</span>
              Draft and manage firm-owned cases
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-success-text">&#10003;</span>
              Run intake, evidence review, and case workflows
            </li>
          </ul>

          {isStripeManaged ? (
            <button onClick={openPortal} disabled={portalLoading} className="btn btn-secondary text-sm w-full">
              {portalLoading ? "Loading..." : "Manage subscription"}
            </button>
          ) : hasAccess ? (
            <p className="text-center text-xs text-text-muted">Membership active — no billing on file.</p>
          ) : (
            <button onClick={startSubscription} disabled={subscribeLoading} className="btn btn-primary text-sm w-full">
              {subscribeLoading ? "Loading..." : "Subscribe — $99/mo"}
            </button>
          )}
        </div>

        {/* Product 2: Lead Claims */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Lead Claims</h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-semibold text-text-secondary">Pay per claim</span>
          </div>

          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums text-text-primary">$150</span>
              <span className="text-sm text-text-muted">/lead</span>
            </div>
            <p className="mt-2 text-sm text-text-secondary">
              Claim a lead to unlock applicant identity, contact details, intake, and case creation.
            </p>
          </div>

          <ul className="space-y-1.5 text-sm text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-success-text">&#10003;</span>
              Full applicant profile &amp; contact info
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-success-text">&#10003;</span>
              Automated intake &amp; case creation
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-success-text">&#10003;</span>
              Requires active membership
            </li>
          </ul>

          <div className="rounded-lg border border-border-default bg-surface-subtle px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">Leads claimed</span>
              <span className="text-sm font-semibold tabular-nums text-text-primary">{completedClaims.length}</span>
            </div>
            {completedClaims.length > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-text-muted">Total spent</span>
                <span className="text-sm font-semibold tabular-nums text-text-primary">${(totalSpent / 100).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {data.hasStripeCustomer && (
        <button
          onClick={openPortal}
          disabled={portalLoading}
          className="text-xs text-text-muted underline hover:text-text-secondary"
        >
          View invoices &amp; payment methods
        </button>
      )}

      {/* Claim payment history */}
      {completedClaims.length > 0 && (
        <div className="table-shell">
          <div className="table-shell-header">
            Payment history
          </div>
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="table-header-cell">Date</th>
                  <th className="table-header-cell">Lead</th>
                  <th className="table-header-cell text-right">Amount</th>
                  <th className="table-header-cell text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {completedClaims.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="table-cell text-text-muted text-xs whitespace-nowrap">
                      {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                    <td className="table-cell">
                      <a href={`/leads/${p.leadId}`} className="text-xs font-medium underline hover:text-text-primary">
                        View lead
                      </a>
                    </td>
                    <td className="table-cell text-right font-semibold tabular-nums text-text-primary">
                      ${(p.amountCents / 100).toFixed(0)}
                    </td>
                    <td className="table-cell text-right">
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-text">
                        Paid
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
