# Applicant funnel

Landing → light wizard → email gate → preliminary result → deep wizard →
consent → attorney visibility. Maturity ladder milestones (M0–M7) ride the
subtitles. See the architecture overview §2.

```mermaid
flowchart TD
  L["Landing page /<br/>hero · SEO · AEO pages"] --> W1["/check light wizard<br/>degree · field · pubs · years"]:::applicant
  W1 --> CK["POST /api/check<br/>preliminary LLM score"]:::platform
  CK --> EG["Email gate<br/>Lead created · M0 → M1"]:::applicant
  EG --> QP["quickPing<br/>OpenAlex + ROR teaser · ≤4 s"]:::platform
  EG -.->|"duplicate email"| DUP["Re-assess branch"]
  EG --> PR["Preliminary result page<br/>tier · gaps · teaser · consent card"]:::applicant
  PR --> DW["Deep wizard<br/>+8 evidence fields"]:::applicant
  DW --> RA["POST /api/leads/[id]/reassess<br/>sanitize · server re-score · M2"]:::platform
  RA --> VL["verifyLead auto-fires<br/>full 11-source corroboration"]:::platform
  RA --> CO["Consent<br/>applicantStatus = approved · M3"]:::applicant
  CO --> M7["Visible to attorneys<br/>M7 · trustScore ≥ 60"]:::attorney

  classDef applicant fill:#E1F5EE,stroke:#0F6E56,color:#04342C
  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
```

Notes:

- The email gate sends two emails: lead confirmation (mirrors the preliminary
  result since PR #283) and an admin alert. The authoritative final-score
  email goes out after `reassess`.
- `reassess` sanitizes `formData` against an allowlist, re-derives the score
  server-side from dimensions, and clamps to the evidence ceiling.
- The free-text `field` is validated client + server
  (`isPlausibleResearchField`, G-3).
- The M7 gate is enforced server-side: `GET /leads/[id]` returns 404 to
  attorneys for any sub-M7 lead.
