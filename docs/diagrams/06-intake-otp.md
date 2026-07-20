# Applicant intake (OTP-gated)

Case intake without an account: tokenized link + email OTP. No case data is
loaded server-side until the OTP passes. See the architecture overview §5.

```mermaid
flowchart TD
  A["Attorney sends intake link<br/>case_intake token · 48 h TTL"]:::attorney --> P["/intake/[token]<br/>no account needed"]:::applicant
  P --> S["POST send-code<br/>6-digit email OTP"]:::caution
  S --> V["POST verify-code"]:::caution
  V --> C["intake_verified cookie<br/>JWT · 4 h"]
  C --> W["6-step intake wizard<br/>personal → recommenders"]:::applicant
  W --> F["formData saved<br/>allowlisted keys · 409 once filed"]

  classDef applicant fill:#E1F5EE,stroke:#0F6E56,color:#04342C
  classDef attorney fill:#FAECE7,stroke:#993C1D,color:#4A1B0C
  classDef caution fill:#FAEEDA,stroke:#854F0B,color:#412402
```

Notes:

- Wizard steps: personal info → EB-2 basis → endeavor → publications →
  recognition → recommenders.
- Logged-in case owners use `/cases/[id]/intake` directly (no OTP needed).
- Intake-link generation is attorney-only — admins cannot create intake or
  guest links (zero-trust admin).
- After filing, `Case.formData` is immutable: content PATCH / intake POST
  return 409; status changes remain allowed.
