# Product overview

The two-sided product at a glance: the applicant funnel feeds the `Lead`
record, the verification engine corroborates it, and only leads at maturity M7
with `trustScore ≥ 60` cross into the attorney side. See
the architecture overview §0–§4.

```mermaid
flowchart TD
  AF["Applicant funnel<br/>/check → consent"]:::applicant --> LEAD["Lead record<br/>score · trust · maturity"]
  VE["Verification engine<br/>11 public sources"]:::platform --> LEAD
  LEAD -->|"M7 · trust ≥ 60"| MP["Attorney marketplace<br/>/network/leads"]:::attorney
  ADM["Admin & pilot tooling<br/>match queue · deliver"] -.-> MP
  MP --> CC["Claim & convert<br/>$150 → Case created"]:::attorney
  CC --> CW["Case workspace<br/>letters · brief · filing"]:::attorney

  classDef applicant fill:#E1F5EE,stroke:#0F6E56,color:#04342C
  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
```

Notes:

- Admin never enters the case workspace — `canAccessCase` returns false for
  admins (attorney–client privilege). Their lane is the match queue, pilot
  delivery/outcomes, refund approvals, attestation, and re-verification.
- The two scores are independent: case strength (LLM, `Lead.score`) vs trust
  (deterministic rules, `Lead.trustScore`).
