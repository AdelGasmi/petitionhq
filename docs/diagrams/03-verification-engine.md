# Verification engine

`verifyLead()` (`lib/verification/orchestrator.ts`): 11 public sources →
identity reconciliation → deterministic trust score → verification level.
Rules only, no LLM. See the architecture overview §1b–§1c and §3.

```mermaid
flowchart TD
  TR["verifyLead()<br/>auto on deep intake · 12s cap · fire-and-forget"]:::platform --> SRC
  subgraph SRC["11 public sources — each writes a LeadVerificationEvent"]
    direction TB
    OA["OpenAlex"] ~~~ NSF["NSF"] ~~~ AX["arXiv"]
    ORC["ORCID"] ~~~ NIH["NIH"] ~~~ DB["DBLP"]
    ROR["ROR"] ~~~ US["USPTO"] ~~~ PMD["PubMed"]
    CR["Crossref"] ~~~ SS["Semantic Scholar"]
  end
  SRC --> IR["Identity reconciliation<br/>resolve one person · drop namesakes"]:::platform
  IR --> TSC["Trust score 0–100<br/>identity + substance + consistency + institution"]:::platform
  TSC --> LV["Verification level"]:::platform
  OAUTH["ORCID OAuth sign-in<br/>the only path to identity_confirmed"]:::success --> LV
  LV --> IC["identity_confirmed"]:::success
  LV --> PC["publicly_corroborated<br/>anchor high / medium"]
  LV --> SR["self_reported<br/>anchor low / none"]
  IC --> P["Persist<br/>trustScore · verifiedClaims · maturity · audit"]
  PC --> P
  SR --> P

  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
  classDef success fill:#EAF3DE,stroke:#3B6D11,color:#173404
```

Notes:

- A ghost (zero agreeing sources) short-circuits the trust score to 0.
- The −15 over-claim penalty fires only on ID-anchored records (TRU-9); a
  name-search match never brands a real, under-indexed researcher an
  over-claimer.
- Cross-source rescue (TRU-7) and OpenAlex fragment merge (TRU-8) protect real
  researchers with common names from false negatives.
- Admin escape hatches: `POST /api/admin/leads/[id]/reverify` and the R0-5
  identity attestation for legit researchers stuck below trust 60.
- Known open issue: Semantic Scholar citation recall is weak for some indexed
  researchers.
