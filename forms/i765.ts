import type { FormConfig } from "./types";

/**
 * I-765 — Application for Employment Authorization.
 * Most commonly filed concurrently with I-485 (no additional USCIS fee).
 * Also filed by asylees, DACA recipients, TPS holders, H-4/L-2 spouses, etc.
 */
export const i765: FormConfig = {
  id: "i765",
  formNumber: "I-765",
  title: "Application for Employment Authorization",
  shortTitle: "EAD (I-765)",
  category: "adjustment",
  description:
    "Apply for an Employment Authorization Document (work permit). Required before working in the US for most non-immigrant and pending-immigrant categories. Free when filed concurrently with I-485.",

  filingFee: {
    uscisFee: 520,
    notes: "No fee when filed concurrently with Form I-485. $520 standalone.",
  },

  processing: {
    serviceCenters: ["Various, based on eligibility category"],
    medianMonths: 4,
    premiumEligible: false,
  },

  advisories: [
    "File concurrently with I-485 to avoid the $520 fee.",
    "You may begin work only after receiving the physical EAD card — a receipt notice is not sufficient.",
    "Auto-extension rules apply for timely-filed renewals in certain categories — check current USCIS guidance.",
    "EAD does not change your underlying immigration status.",
  ],

  eligibility: [
    {
      id: "eligible-category",
      label: "Eligible category",
      explanation:
        "Must fall under one of the USCIS eligibility categories (e.g., pending I-485, asylee, refugee, DACA, TPS, H-4, L-2, dependent of E visa holder, etc.).",
      severity: "must",
    },
    {
      id: "valid-status",
      label: "Lawful status or pending application",
      explanation:
        "Must currently be in a qualifying status or have a concurrently filed or pending I-485.",
      severity: "must",
    },
  ],

  sections: [
    {
      id: "applicant",
      title: "Applicant Information",
      description: "Mirrors Part 1 of the I-765. Populates the pre-filled PDF directly.",
      fields: [
        // ── Name ──────────────────────────────────────────────────────────
        { id: "familyName", type: "text", label: "Family name (last name)", required: true, uscisRef: "Part 1, Item 1a" },
        { id: "givenName", type: "text", label: "Given name (first name)", required: true, uscisRef: "Part 1, Item 1b" },
        { id: "middleName", type: "text", label: "Middle name", uscisRef: "Part 1, Item 1c" },
        { id: "otherFamilyName", type: "text", label: "Other family name used (maiden, alias)", uscisRef: "Part 1, Item 2a" },
        { id: "otherGivenName", type: "text", label: "Other given name used", uscisRef: "Part 1, Item 2b" },
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
        { id: "uscisOnlineAccount", type: "text", label: "USCIS Online Account Number (if any)" },
        { id: "ssn", type: "ssn", label: "SSN (if any)" },
        // ── Address ───────────────────────────────────────────────────────
        { id: "currentAddress", type: "address", label: "Current US mailing address", required: true },
        // ── Contact ───────────────────────────────────────────────────────
        { id: "phone", type: "text", label: "Daytime phone number" },
        { id: "email", type: "text", label: "Email address" },
      ],
    },
    {
      id: "eligibility",
      title: "Eligibility Category",
      description: "Select the category that best describes your basis for filing.",
      fields: [
        {
          id: "category",
          type: "select",
          label: "Eligibility category",
          required: true,
          options: [
            { value: "(c)(9)", label: "(c)(9) — Pending I-485 Adjustment of Status" },
            { value: "(a)(5)", label: "(a)(5) — Asylee" },
            { value: "(a)(3)", label: "(a)(3) — Refugee" },
            { value: "(c)(33)", label: "(c)(33) — DACA recipient" },
            { value: "(a)(12)", label: "(a)(12) — TPS holder" },
            { value: "(c)(26)", label: "(c)(26) — H-4 spouse of H-1B" },
            { value: "(a)(18)", label: "(a)(18) — Pending asylum applicant (>180 days)" },
            { value: "other", label: "Other (specify)" },
          ],
        },
        { id: "categoryOther", type: "text", label: "Other category description (if applicable)" },
        { id: "i485ReceiptNumber", type: "text", label: "I-485 receipt number (if concurrent)" },
        { id: "priorEadNumber", type: "text", label: "Prior EAD card number (if renewing)" },
        { id: "priorEadExpiry", type: "date", label: "Prior EAD expiry date (if renewing)" },
      ],
    },
    {
      id: "travel",
      title: "Travel Outside the US",
      fields: [
        {
          id: "traveledSinceEntry",
          type: "select",
          label: "Have you traveled outside the US since your most recent entry?",
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
        },
        { id: "lastEntryDate", type: "date", label: "Date of most recent entry into the US" },
        { id: "lastEntryPlace", type: "text", label: "Port of entry" },
        { id: "i94Number", type: "text", label: "I-94 Arrival-Departure Record Number" },
        { id: "statusExpiry", type: "date", label: "Authorized stay expiry (from I-94)" },
      ],
    },
  ],

  documents: [
    {
      id: "passport-bio",
      title: "Passport biographic page",
      description: "Color copy of the biographic page of all passports held.",
      required: true,
    },
    {
      id: "i94",
      title: "I-94 Arrival-Departure Record",
      description: "Print from CBP website (i94.cbp.dhs.gov) or physical I-94 card.",
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
      title: "I-485 receipt notice (if concurrent)",
      description: "Form I-797 receipt notice for the pending I-485.",
      required: false,
    },
    {
      id: "prior-ead",
      title: "Copy of prior EAD (if renewing)",
      description: "Front and back of most recent EAD card.",
      required: false,
    },
    {
      id: "category-evidence",
      title: "Evidence of eligibility category",
      description:
        "Supporting document proving the basis for EAD (e.g., asylum grant notice, I-140 approval, TPS approval, H-4 status evidence, etc.).",
      required: true,
    },
    {
      id: "birth-cert",
      title: "Birth certificate",
      description: "With certified English translation if not in English.",
      required: false,
    },
  ],

  letters: [
    {
      id: "cover-letter",
      title: "Filing Cover Letter",
      kind: "petition-letter",
      description:
        "Transmittal letter listing the eligibility category, basis for filing, and all enclosed documents. Standard for organized I-765 submissions.",
      required: true,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 300, maxWords: 600 },
        tone: "professional",
        mustAddress: [
          "Applicant's full name, A-Number, and date of birth",
          "Eligibility category code and description",
          "Whether filed concurrently with I-485 and receipt number",
          "Itemized list of all enclosed documents",
          "Request for combo card (EAD + Advance Parole) if applicable",
        ],
      },
    },
    {
      id: "category-explanation",
      title: "Eligibility Category Explanation Letter",
      kind: "petition-letter",
      description:
        "Letter explaining the applicant's eligibility category, current immigration status, and basis for employment authorization. Useful for complex or less common categories.",
      required: false,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 300, maxWords: 700 },
        tone: "professional",
        mustAddress: [
          "Current immigration status and how applicant entered the US",
          "Specific eligibility category and regulatory basis (8 CFR citation)",
          "Underlying petition or status that supports the category",
          "Any prior EADs and continuity of employment authorization",
        ],
      },
    },
  ],
};
