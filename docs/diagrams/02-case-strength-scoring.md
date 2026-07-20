# Case-strength scoring pipeline

`POST /api/check` (`app/api/check/route.ts` + `lib/scoring.ts`). The LLM's own
overall number is discarded: the score is a deterministic weighted sum of the
five Dhanasar dimensions, then hard-capped by the evidence ceiling. See
the architecture overview §1a.

```mermaid
flowchart TD
  RQ["POST /api/check"] --> TS["Turnstile CAPTCHA verify"]
  TS -->|"fail"| R403["403"]:::danger
  TS -->|"pass"| MODE{"All 8 deep fields blank?"}
  MODE -->|"yes"| PM["Preliminary mode<br/>median assumptions · encouraging prompt"]
  MODE -->|"no"| FM["Full mode<br/>honest prompt"]
  PM --> LLM["LLM assessment<br/>fast tier · temperature 0 · structured JSON"]:::platform
  FM --> LLM
  LLM --> WS["Deterministic override<br/>weighted sum of 5 Dhanasar dimensions"]:::platform
  WS --> EC["Evidence ceiling clamp<br/>score = min(score, ceiling)"]:::caution
  EC --> TIER["Tier + response<br/>≥75 strong · ≥50 developing · else early"]

  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
  classDef caution fill:#FAEEDA,stroke:#854F0B,color:#412402
  classDef danger fill:#FCEBEB,stroke:#A32D2D,color:#501313
```

Notes:

- Dimension weights: EB-2 baseline 15% · prong-1 merit 25% · prong-1
  importance 20% · prong-2 25% · prong-3 15%.
- The evidence ceiling is derived only from self-reported
  publications/citations (+ award/grant/patent lifts) — an empty research
  record can never read as Strong.
- The clamp is re-applied at every write/read boundary
  (`clampScoreToEvidence` / `resolveCandidateScore`), so a stored score never
  drifts above the evidence.
- Funnel events `check.started` / `check.completed` fire around the pipeline.
