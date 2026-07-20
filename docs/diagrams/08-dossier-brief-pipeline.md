# Dossier & brief generation

Two document paths: the automated dossier preview (cron) and the attorney's
editable `.docx` export behind the provenance firewall. See
the architecture overview §5.

## Dossier cron (un-curated preview)

```mermaid
flowchart LR
  subgraph CRON["POST /api/cron/process-dossiers — every 5 min"]
    SK["Skeleton"]:::platform --> SEC["3 brief sections<br/>parallel"]:::platform --> GR["Grounding check"]:::caution --> PDF["PDF → R2<br/>dossierPdfPath"]
  end

  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
  classDef caution fill:#FAEEDA,stroke:#854F0B,color:#412402
```

## Attorney .docx export (provenance firewall)

```mermaid
flowchart LR
  LED["Claim-curation ledger<br/>approved atoms · SHA-256 ledgerRoot"] -.->|"null = un-curated, all atoms allowed"| GEN
  GEN["GET /api/leads/[id]/brief<br/>editable .docx"]:::attorney --> FW{"Provenance firewall<br/>numeric claims cited?"}
  FW -->|"flagged"| B422["422 blocked<br/>re-export with ?ack=1 · audit-logged"]:::danger
  FW -->|"clean"| OK["Export"]:::success

  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef danger fill:#FCEBEB,stroke:#A32D2D,color:#501313
  classDef success fill:#EAF3DE,stroke:#3B6D11,color:#173404
```

Notes:

- Dossier PDF page 1 carries the Verification & Provenance table
  (trust + verifiedClaims). Null `claimLedger` ⇒ all atoms allowed; once a
  ledger is signed, generation is approved-atoms-only.
- The firewall (`lib/dossier/provenanceLinter.ts`, TRU-5) flags numeric claims
  lacking a verified-source citation or `[self-reported]` tag.
- The case-workspace brief export (`GET /api/cases/[id]/brief/[n]/export`) is
  white-label PDF/DOCX — no PetitionHQ branding on the attorney's filed work
  product. Eval artifacts (dossier teaser, verification report) keep branding.
