# Claim payment & refund lifecycle

The $150 claim and both refund routes. Stripe-first, then DB writes — never a
Stripe call inside a DB transaction.

```mermaid
flowchart TD
  CL["Claim lead — $150<br/>Stripe checkout / pilot"]:::attorney --> LCP["LeadClaimPayment<br/>claim recorded"]
  LCP --> GH["Ghost auto-refund<br/>refund-ghosted cron · 14 days no contact"]:::caution
  LCP --> MR["Misrep refund request<br/>attorney · 30-day window"]:::caution
  MR --> AD["Admin approve / deny<br/>/admin/refunds"]
  GH --> SF["Stripe refund first<br/>then DB writes"]
  AD -->|"approved"| SF
  AD -->|"denied"| DN["Refund denied email"]
  SF --> WH["charge.refunded webhook<br/>reconciles final state · WebhookEvent idempotency"]:::success
  WH --> RT["Lead returned to pool<br/>lead-returned email"]

  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef caution fill:#FAEEDA,stroke:#854F0B,color:#412402
  classDef success fill:#EAF3DE,stroke:#3B6D11,color:#173404
```

Notes:

- The ghost cron runs daily at 08:00 and carries a double-refund guard
  (tightened in the pre-launch pass).
- `release-ghosted-pilots` (daily 08:15) is the pilot-delivery analogue:
  stale concierge deliveries are released back to the pool.
- The `charge.refunded` webhook is the reconciliation source of truth — DB
  state converges to Stripe, not the other way around.
