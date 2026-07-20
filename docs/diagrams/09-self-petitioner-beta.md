# Self-petitioner beta

A consented lead becomes a free self-drafting beta user: one-click admin
conversion, a single invite email, a hard agreement gate, self-serve drafting
under a per-case cost cap, and an admin kill switch. No fictional attorney
review is ever implied to the applicant. See the architecture overview (no §
yet — shipped 2026-07-01 through 2026-07-04, PRs #300–#305).

```mermaid
flowchart TD
  CQ["Consented lead<br/>applicantStatus=approved (see 01)"]:::applicant --> BTN["/admin/leads<br/>'Create beta case →' button"]

  BTN --> CONV["POST /admin/leads/[id]/beta-convert<br/>admin-only · guards: not claimed/converted ·<br/>approved · no existing user · founder configured"]:::caution

  CONV --> ATOMIC["Atomically:<br/>• applicant User created (role=applicant, selfPetitionerBeta=true)<br/>• lead claimed by founder-attorney account (concierge, not a reviewer)<br/>• Case created — ownerId=applicant, attorneyId=founder<br/>• formData pre-filled from /check answers<br/>• marketplace intake email SKIPPED (no duplicate 'attorney accepted' mail)"]:::platform

  ATOMIC --> INV["sendBetaInviteEmail — ONE email<br/>'not a law firm' disclosure · /invite/user/[token] · 7-day TTL"]:::applicant

  INV --> SETPW["/invite/user/[token]<br/>sets password → account activated, session issued"]:::applicant
  SETPW --> LIST["/cases → opens their case"]:::applicant

  LIST --> GATE{"/cases/[id]<br/>server-side: betaAgreementAcceptedAt set?"}:::caution
  GATE -->|"no — first visit"| AGREE["BetaAgreementGate — full-page block<br/>'not a law firm' · 'no attorney reviews your case' ·<br/>free beta · link to Terms"]:::caution
  AGREE --> ACCEPT["POST /profile/beta-agreement<br/>stamps betaAgreementAcceptedAt"]:::applicant
  ACCEPT --> WORK
  GATE -->|"yes"| WORK["Case workspace renders<br/>BetaBanner shown · AttorneyPanel/ReviewRequestPanel HIDDEN"]:::applicant

  WORK --> DRAFT["Letters/brief drafting (8 routes)<br/>canDraftCase(): owner + selfPetitionerBeta"]:::caution
  DRAFT --> CAP{"betaCostCapReached()<br/>Σ LlmUsage.cents this case ≥ $2.00"}:::caution
  CAP -->|"no"| RULES["resolveDraftingGuidance()<br/>→ loadApplicantGuidance(User.draftingRules)"]:::platform
  RULES --> GEN["Draft generated<br/>[CITE ...] markers highlighted red"]:::success
  CAP -->|"yes → 429"| LIMIT["BETA_LIMIT_MESSAGE shown:<br/>'Beta limit reached — reply to us and we'll help you finish this.'"]:::danger

  PROF["/profile/drafting-rules<br/>(link shown only if selfPetitionerBeta)"]:::applicant -.-> RULES

  WORK -.-> PILOT["/admin/pilot<br/>BetaAccessPanel: agreement date · cost-vs-$2 cap bar"]
  PILOT --> DEACT["Deactivate button<br/>POST /admin/users/[id]/beta-deactivate"]:::danger
  DEACT --> OFF["selfPetitionerBeta = false<br/>canDraftCase() now false — case & account untouched,<br/>falls back to founder-attorney access only"]:::danger

  classDef applicant fill:#E1F5EE,stroke:#0F6E56,color:#04342C
  classDef platform fill:#EEEDFE,stroke:#534AB7,color:#26215C
  classDef caution fill:#FAEEDA,stroke:#854F0B,color:#412402
  classDef success fill:#EAF3DE,stroke:#3B6D11,color:#173404
  classDef danger fill:#FCEBEB,stroke:#A32D2D,color:#501313
```

Notes:

- Trigger is always admin-initiated (`BetaConvertButton` on `/admin/leads`) —
  there is no self-serve beta signup.
- The "attorney" on a beta case is always the founder's concierge account
  (`FOUNDER_ATTORNEY_EMAIL`), never a real reviewer. This is enforced twice:
  the invite email and agreement text say so explicitly, and the case
  workspace hides `AttorneyPanel`/`ReviewRequestPanel` entirely for beta
  users so the UI can't imply a review is happening.
- The agreement gate is server-enforced in `app/cases/[id]/page.tsx` before
  any case content renders — not just a client-side dialog.
- The $2.00/case cost cap and per-case cost visibility both read the same
  `LlmUsage` ledger the admin leads page already sums for its "cost" column
  — no separate metering system.
- Drafting-rules are per-user (`User.draftingRules`), parallel to the
  attorney-side `FirmProfile` rules; `resolveDraftingGuidance()` is the one
  entry point that branches between them by session role.
- Deactivation is a soft kill switch — it only flips `selfPetitionerBeta`.
  The user, case, and drafts are untouched; `canDraftCase()` simply stops
  granting the self-serve path, and the case falls back to whatever the
  assigned (founder) attorney can already do.
- Feedback is a single `mailto:` link in the persistent `BetaBanner`, not a
  form — deliberately lightweight for a small beta cohort.
