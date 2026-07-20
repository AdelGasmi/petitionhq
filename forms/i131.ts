import type { FormConfig } from "./types";

/**
 * I-131 — Application for Travel Document (Advance Parole / Re-entry Permit / Refugee Travel Document).
 * Most commonly filed concurrently with I-485 to allow international travel during pending adjustment.
 * Free when filed concurrently with I-485.
 */
export const i131: FormConfig = {
  id: "i131",
  formNumber: "I-131",
  title: "Application for Travel Document",
  shortTitle: "Advance Parole (I-131)",
  category: "adjustment",
  description:
    "Apply for Advance Parole (AP) to travel internationally while an I-485 is pending, a Re-entry Permit (to preserve LPR status during extended absence), or a Refugee Travel Document. Free when filed concurrently with I-485.",

  filingFee: {
    uscisFee: 630,
    notes: "No fee when filed concurrently with Form I-485. $630 standalone. Some humanitarian categories are fee-exempt.",
  },

  processing: {
    serviceCenters: ["Various, based on travel document type"],
    medianMonths: 4,
    premiumEligible: false,
  },

  advisories: [
    "CRITICAL: Do NOT travel internationally while I-485 is pending without valid Advance Parole in hand. Departure without AP abandons the I-485.",
    "File concurrently with I-485 (and I-765) to avoid the fee — commonly called the 'combo card' request.",
    "Advance Parole is NOT a visa — it does not guarantee re-entry. CBP still has discretion at the port of entry.",
    "H-1B or L-1 status holders with pending I-485 can generally travel on their H/L visa instead of AP.",
    "Re-entry Permit must be applied for while physically in the US, before departure.",
  ],

  eligibility: [
    {
      id: "pending-i485",
      label: "Pending I-485 (for Advance Parole)",
      explanation:
        "Must have a pending Adjustment of Status application to qualify for Advance Parole.",
      severity: "must",
      framework: { name: "Advance Parole", prong: "pending I-485" },
    },
    {
      id: "lpr-status",
      label: "LPR status (for Re-entry Permit)",
      explanation:
        "Must be a Lawful Permanent Resident filing before departing the US for an extended trip (over 1 year).",
      severity: "should",
      framework: { name: "Re-entry Permit" },
    },
    {
      id: "refugee-asylee",
      label: "Refugee or asylee status (for Refugee Travel Document)",
      explanation:
        "Must be a refugee admitted to the US or an asylee to qualify for a Refugee Travel Document.",
      severity: "should",
      framework: { name: "Refugee Travel Document" },
    },
  ],

  sections: [
    {
      id: "applicant",
      title: "Applicant Information",
      description: "Mirrors Part 2 of the I-131. Populates the pre-filled PDF directly.",
      fields: [
        // ── Name ──────────────────────────────────────────────────────────
        { id: "familyName", type: "text", label: "Family name (last name)", required: true },
        { id: "givenName", type: "text", label: "Given name (first name)", required: true },
        { id: "middleName", type: "text", label: "Middle name" },
        { id: "otherFamilyName", type: "text", label: "Other family name used (maiden, alias)" },
        { id: "otherGivenName", type: "text", label: "Other given name used" },
        // ── Personal ──────────────────────────────────────────────────────
        { id: "sex", type: "select", label: "Sex", required: true, options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]},
        { id: "dob", type: "date", label: "Date of birth", required: true },
        { id: "cityOfBirth", type: "text", label: "City/town of birth", required: true },
        { id: "countryOfBirth", type: "text", label: "Country of birth", required: true },
        { id: "countryOfCitizenship", type: "text", label: "Country of citizenship/nationality", required: true },
        // ── IDs ───────────────────────────────────────────────────────────
        { id: "alienNumber", type: "alienNumber", label: "A-Number (if any)" },
        { id: "ssn", type: "ssn", label: "SSN (if any)" },
        // ── Address ───────────────────────────────────────────────────────
        { id: "currentAddress", type: "address", label: "Current US mailing address", required: true },
        // ── Contact ───────────────────────────────────────────────────────
        { id: "phone", type: "text", label: "Daytime phone number" },
        { id: "email", type: "text", label: "Email address" },
      ],
    },
    {
      id: "document-type",
      title: "Type of Travel Document",
      fields: [
        {
          id: "documentType",
          type: "select",
          label: "Document type requested",
          required: true,
          options: [
            { value: "advance-parole", label: "Advance Parole (pending I-485 or TPS)" },
            { value: "reentry-permit", label: "Re-entry Permit (LPR traveling >1 year)" },
            { value: "refugee-travel", label: "Refugee Travel Document (refugee/asylee)" },
            { value: "combo-card", label: "Combo Card — EAD + Advance Parole (concurrent I-485)" },
          ],
        },
        { id: "i485ReceiptNumber", type: "text", label: "I-485 receipt number" },
        { id: "i485FiledDate", type: "date", label: "I-485 filing date" },
      ],
    },
    {
      id: "travel-plans",
      title: "Proposed Travel",
      fields: [
        {
          id: "purposeOfTravel",
          type: "textarea",
          label: "Purpose of proposed travel",
          help: "Describe the reason you need to travel abroad while your application is pending.",
          required: true,
        },
        { id: "countries", type: "text", label: "Countries you intend to visit", required: true },
        { id: "departureDate", type: "date", label: "Anticipated departure date" },
        { id: "returnDate", type: "date", label: "Anticipated return date" },
        {
          id: "priorParole",
          type: "select",
          label: "Have you previously been granted Advance Parole?",
          options: [
            { value: "no", label: "No" },
            { value: "yes", label: "Yes" },
          ],
        },
        { id: "priorParoleExpiry", type: "date", label: "Prior Advance Parole expiry (if applicable)" },
      ],
    },
  ],

  documents: [
    {
      id: "passport-bio",
      title: "Passport biographic page",
      description: "Color copy of all valid passports held.",
      required: true,
    },
    {
      id: "photos",
      title: "Two passport-style photos",
      description: "Taken within 30 days of filing, white background.",
      required: true,
    },
    {
      id: "i485-receipt",
      title: "I-485 receipt notice",
      description: "Form I-797 showing I-485 is pending.",
      required: true,
    },
    {
      id: "i94",
      title: "I-94 Arrival-Departure Record",
      description: "Current I-94 or printout from cbp.dhs.gov.",
      required: true,
    },
    {
      id: "prior-ap",
      title: "Prior Advance Parole document (if renewing)",
      description: "Copy of any previously issued AP document.",
      required: false,
    },
    {
      id: "travel-evidence",
      title: "Evidence supporting travel need",
      description:
        "Documentation showing the necessity of travel (medical records, funeral arrangements, employer letter, etc.) if urgent processing is requested.",
      required: false,
    },
    {
      id: "green-card",
      title: "Permanent Resident Card (Re-entry Permit only)",
      description: "Both sides of the green card, for LPRs applying for Re-entry Permit.",
      required: false,
    },
  ],

  letters: [
    {
      id: "cover-letter",
      title: "Filing Cover Letter",
      kind: "petition-letter",
      description:
        "Transmittal letter identifying the type of travel document requested, the basis for filing, and listing all enclosed documents.",
      required: true,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 300, maxWords: 600 },
        tone: "professional",
        mustAddress: [
          "Applicant's full name, A-Number, and date of birth",
          "Type of travel document requested (AP / Re-entry Permit / Combo Card)",
          "I-485 receipt number and filing date (if applicable)",
          "Brief statement of travel purpose",
          "Itemized list of all enclosed documents",
        ],
      },
    },
    {
      id: "travel-necessity",
      title: "Travel Necessity Letter",
      kind: "petition-letter",
      description:
        "Letter explaining the specific reasons the applicant needs to travel internationally while their I-485 is pending. Strengthens urgent processing requests and explains the purpose and duration of travel.",
      required: false,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 300, maxWords: 600 },
        tone: "professional",
        mustAddress: [
          "Specific reason and purpose of proposed travel",
          "Countries to be visited and intended duration",
          "Confirmation that applicant understands AP must be in hand before departure",
          "Acknowledgment that H-1B/L-1 visa (if applicable) will be used alternatively for re-entry",
          "Statement of intent to return and continue pursuing permanent residence",
        ],
      },
    },
  ],
};
