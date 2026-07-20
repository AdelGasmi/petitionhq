# Recommendation-letter workflow

Attorney drives, AI drafts, recommender reviews through a tokenized portal.
See the architecture overview §5.

## Action flow

```mermaid
flowchart TD
  C["Create letter<br/>recommender name · title · kind"]:::attorney --> D["AI draft (or SSE stream)<br/>firm draftingRules + grounding"]:::platform
  D --> E["Edit + assess<br/>quality score · comments · versions"]:::attorney
  E --> S["Send for review<br/>emails /review/[token] · 14 d"]:::attorney
  S --> R["Recommender edits + submits<br/>no account"]:::applicant
  R --> F["Finalize + export<br/>PDF / DOCX"]:::attorney

  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef applicant fill:#E1F5EE,stroke:#0F6E56,color:#04342C
  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
```

## LetterStatus state machine

```mermaid
stateDiagram-v2
  state "pending-review" as pending
  [*] --> draft: AI draft created
  draft --> pending: send-review
  pending --> submitted: recommender submits
  submitted --> final: attorney finalizes
  final --> [*]
```

Notes:

- Every draft/regenerate is versioned in `LetterVersion`; comments live in
  `LetterComment`.
- The `remind-recommenders` cron (daily 09:00) nudges ghosted recommenders at
  day 5 and day 10.
- Letter drafting injects the firm's `/network/rules` preferences; drafting
  temperature is server-capped at 0.45 (default 0.4) regardless of client
  settings.
