# Attorney funnel

From the marketing page to a working case. See the architecture overview §4.

```mermaid
flowchart TD
  FA["/for-attorneys<br/>marketing + application form"]:::attorney --> OB["Firm onboarding<br/>/onboarding/firm · FirmProfile"]:::attorney
  OB --> DSH["/network/dashboard<br/>metrics · follow-up alerts"]:::attorney
  DSH --> MKT["/network/leads<br/>M7 marketplace · anonymous cards"]:::attorney
  MKT --> EV["/leads/[id] evaluation<br/>verification · commercial fit · assessment"]:::attorney
  EV --> CL["Claim — $150<br/>Stripe / pilot / subscription"]:::caution
  CL --> CV["Convert to case<br/>formData pre-filled · intake link"]
  CV --> CW["/cases/[id] workspace<br/>letters · brief · filing"]:::attorney

  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef caution fill:#FAEEDA,stroke:#854F0B,color:#412402
```

Notes:

- Pre-claim anonymity: marketplace cards show only "{field} Researcher";
  verification source links unlock only for the claiming attorney.
- Sort options: newest / score / trust — trust and score sorts add
  `orcidAuthenticated desc` as secondary key (TRU-2).
- Lead evaluation sections: Verification & Provenance, Commercial Fit
  (POS-1/2), Profile Snapshot, AI Legal Assessment, Detailed Evidence, Exhibit
  Plan, prong-1 draft teaser.
- Attorney auth includes self-serve password reset via emailed 6-digit code
  (PR #282).
