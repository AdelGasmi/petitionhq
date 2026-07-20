# Flow diagrams

Mermaid sources for every live product flow, kept next to the architecture overview
(the prose source of truth) so a flow change and its chart can ship in the same
PR. GitHub renders these inline in blob view and in PR diffs.

| # | File | Flow | the architecture overview |
|---|------|------|---------|
| 00 | [product-overview](00-product-overview.md) | The two-sided product at a glance | §0–§4 |
| 01 | [applicant-funnel](01-applicant-funnel.md) | Landing → /check → consent → M7 | §2 |
| 02 | [case-strength-scoring](02-case-strength-scoring.md) | `POST /api/check` scoring pipeline | §1a |
| 03 | [verification-engine](03-verification-engine.md) | 11 sources → identity → trust → level | §1b–§1c, §3 |
| 04 | [attorney-funnel](04-attorney-funnel.md) | Apply → marketplace → claim → case | §4 |
| 05 | [claim-refund-lifecycle](05-claim-refund-lifecycle.md) | $150 claim, ghost + misrep refunds | §4 (step 6), §11 |
| 06 | [intake-otp](06-intake-otp.md) | OTP-gated applicant intake | §5 |
| 07 | [letter-workflow](07-letter-workflow.md) | Recommendation-letter state machine | §5 |
| 08 | [dossier-brief-pipeline](08-dossier-brief-pipeline.md) | Dossier cron + provenance firewall | §5 |
| 09 | [self-petitioner-beta](09-self-petitioner-beta.md) | Admin-converted lead → free self-drafting beta user | (none yet) |

## Conventions

Shared `classDef` color roles (defined per file, only where used):

- `applicant` (teal) — applicant-facing step
- `attorney` (coral) — attorney-facing step
- `platform` (purple) — automated / AI machinery
- `caution` (amber) — deterministic guard, gate, or clamp
- `success` (green) / `danger` (red) — terminal outcomes
- unstyled — neutral system step

Dashed arrows mean an optional or out-of-band path (admin concierge delivery,
duplicate-email branch, claim-ledger gating).

Last reconciled 2026-07-04: added 09 (self-petitioner beta), reconciled
against the live code (PRs #300–#305) rather than the architecture overview, which has no
beta section yet. Prior reconciliation was 2026-07-01 against the architecture overview
(prod-verified 2026-06-24) plus PR #282 (attorney password reset) and
PR #283 (/check email reconciliation).
