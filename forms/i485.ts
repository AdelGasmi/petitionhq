import type { FormConfig } from "./types";

/**
 * I-485 — Adjustment of Status.
 * Stub showing the form engine handles the largest and most complex USCIS form.
 */
export const i485: FormConfig = {
  id: "i485",
  formNumber: "I-485",
  title: "Application to Register Permanent Residence or Adjust Status",
  shortTitle: "I-485 AOS",
  category: "adjustment",
  description:
    "Application to become a Lawful Permanent Resident while inside the US, based on an approved or concurrently filed immigrant petition.",

  filingFee: {
    uscisFee: 1440,
    biometricsFee: 0,
    notes: "Fee is $950 for applicants under 14 filing with a parent. Reduced fees for some humanitarian categories.",
  },

  processing: {
    serviceCenters: ["Various, based on category"],
    medianMonths: 12,
    premiumEligible: false,
  },

  advisories: [
    "File only when priority date is current (for preference categories) or underlying petition is approved.",
    "Requires valid underlying basis: I-130, I-140, asylum grant, refugee status, or other.",
    "I-693 medical exam required — must be from a USCIS-designated civil surgeon.",
    "EAD (I-765) and Advance Parole (I-131) can be filed concurrently at no extra cost.",
  ],

  eligibility: [
    {
      id: "underlying-basis",
      label: "Valid underlying petition or basis",
      explanation:
        "Must have an approved or concurrently filed I-130, I-140, asylum grant, or other qualifying basis.",
      severity: "must",
    },
    {
      id: "priority-date-current",
      label: "Priority date is current (if preference category)",
      explanation: "Check the Visa Bulletin for current priority dates in your category.",
      severity: "must",
    },
    {
      id: "lawful-entry",
      label: "Inspected and admitted or paroled",
      explanation: "With some exceptions, must have entered the US lawfully.",
      severity: "must",
    },
    {
      id: "no-bars",
      label: "No bars to adjustment",
      explanation:
        "Certain criminal, immigration, or public charge issues can bar adjustment. Review 212(a) grounds carefully.",
      severity: "must",
    },
  ],

  sections: [
    {
      id: "applicant",
      title: "Applicant Information",
      description: "Mirrors Part 1 of the I-485. Every field here populates the pre-filled PDF directly.",
      fields: [
        // ── Name ──────────────────────────────────────────────────────────
        { id: "familyName", type: "text", label: "Family name (last name)", required: true, uscisRef: "Part 1, Item 1a" },
        { id: "givenName", type: "text", label: "Given name (first name)", required: true, uscisRef: "Part 1, Item 1b" },
        { id: "middleName", type: "text", label: "Middle name", uscisRef: "Part 1, Item 1c" },
        { id: "otherFamilyName", type: "text", label: "Other family name used (maiden, alias, prior legal name)", uscisRef: "Part 1, Item 2a" },
        { id: "otherGivenName", type: "text", label: "Other given name used", uscisRef: "Part 1, Item 2b" },
        { id: "otherMiddleName", type: "text", label: "Other middle name used", uscisRef: "Part 1, Item 2c" },
        // ── Personal ──────────────────────────────────────────────────────
        { id: "sex", type: "select", label: "Sex", required: true, options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]},
        { id: "dob", type: "date", label: "Date of birth", required: true, uscisRef: "Part 1, Item 3" },
        { id: "cityOfBirth", type: "text", label: "City/town of birth", required: true, uscisRef: "Part 1, Item 7a" },
        { id: "countryOfBirth", type: "text", label: "Country of birth", required: true, uscisRef: "Part 1, Item 7b" },
        { id: "countryOfCitizenship", type: "text", label: "Country of citizenship/nationality", required: true, uscisRef: "Part 1, Item 8" },
        // ── IDs ───────────────────────────────────────────────────────────
        { id: "alienNumber", type: "alienNumber", label: "A-Number (if any)", uscisRef: "Part 1" },
        { id: "uscisOnlineAccount", type: "text", label: "USCIS Online Account Number (if any)", uscisRef: "Part 1, Item 9" },
        { id: "ssn", type: "ssn", label: "SSN (if any)", uscisRef: "Part 1, Item 19" },
        // ── Address ───────────────────────────────────────────────────────
        { id: "currentAddress", type: "address", label: "Current US mailing address", required: true, uscisRef: "Part 1, Item 18" },
        // ── Contact ───────────────────────────────────────────────────────
        { id: "phone", type: "text", label: "Daytime phone number" },
        { id: "email", type: "text", label: "Email address" },
        // ── Passport & Entry ──────────────────────────────────────────────
        { id: "passportNumber", type: "text", label: "Passport number", uscisRef: "Part 1, Item 10a" },
        { id: "passportCountry", type: "text", label: "Passport issuing country", uscisRef: "Part 1, Item 10b" },
        { id: "passportExpiry", type: "date", label: "Passport expiration date", uscisRef: "Part 1, Item 10c" },
        { id: "visaNumber", type: "text", label: "US visa number (if any)", uscisRef: "Part 1, Item 10d" },
        { id: "lastEntryDate", type: "date", label: "Date of last entry into the US", uscisRef: "Part 1, Item 10e" },
        { id: "i94Number", type: "text", label: "I-94 Arrival-Departure Record Number", uscisRef: "Part 1, Item 12" },
        { id: "currentStatus", type: "text", label: "Current immigration status / class of admission (e.g. H-1B, F-1)", uscisRef: "Part 1, Item 14" },
        { id: "statusExpiry", type: "date", label: "Authorized stay expiry (from I-94, if applicable)" },
      ],
    },
    {
      id: "application-type",
      title: "Application Type / Category",
      fields: [
        { id: "category", type: "select", label: "Basis for adjustment", required: true, options: [
          { value: "family-immediate", label: "Family — Immediate Relative (IR)" },
          { value: "family-preference", label: "Family — Preference (F1, F2A, F2B, F3, F4)" },
          { value: "employment", label: "Employment-based (EB-1, EB-2, EB-3, EB-4, EB-5)" },
          { value: "asylum", label: "Asylum" },
          { value: "refugee", label: "Refugee" },
          { value: "special-immigrant", label: "Special Immigrant" },
          { value: "diversity", label: "Diversity Lottery (DV)" },
        ]},
        { id: "priorityDate", type: "date", label: "Priority date (if preference category)" },
        { id: "underlyingReceiptNumber", type: "text", label: "Underlying petition receipt number (I-130 or I-140)", uscisRef: "Part 2, Item 11" },
      ],
    },
  ],

  documents: [
    { id: "approval-notice", title: "Underlying petition approval notice (I-797)", description: "Or filing receipt if concurrent.", required: true },
    { id: "birth-cert", title: "Birth certificate", description: "With certified English translation.", required: true },
    { id: "passport-pages", title: "Passport — all pages with entries/visas", description: "", required: true },
    { id: "i94-all", title: "All I-94 records", description: "Every US entry.", required: true },
    { id: "i693", title: "Medical exam (Form I-693)", description: "From USCIS-designated civil surgeon, in sealed envelope.", required: true },
    { id: "photos", title: "Two passport-style photos", description: "Taken within 30 days of filing.", required: true },
    { id: "tax-returns", title: "Tax returns", description: "Last 3 years if employment-based.", required: false },
    { id: "i864", title: "Affidavit of Support (I-864)", description: "For family-based adjustment.", required: false },
    { id: "marriage-cert", title: "Marriage certificate", description: "If family-based spousal case.", required: false },
    { id: "vaccination-record", title: "Vaccination record", description: "Provided to civil surgeon at medical exam.", required: true },
  ],

  letters: [
    {
      id: "cover-letter",
      title: "Filing Cover Letter",
      kind: "petition-letter",
      description:
        "Comprehensive transmittal letter to USCIS that introduces the applicant, states the basis for adjustment, lists every enclosed document and exhibit, and requests approval. Required for all organized filings.",
      required: true,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 600, maxWords: 1200 },
        tone: "professional",
        mustAddress: [
          "Applicant's full name, A-Number, and date of birth",
          "Basis for adjustment (underlying petition type and receipt/approval number)",
          "Current immigration status and date of last entry",
          "Itemized table of contents listing every enclosed document",
          "Filing fee amount enclosed or fee waiver request",
          "Request for EAD and Advance Parole if filing concurrently",
          "Attorney/preparer information and signature block",
        ],
      },
    },
    {
      id: "personal-statement",
      title: "Personal Statement",
      kind: "petition-letter",
      description:
        "Optional narrative by the applicant explaining their immigration history, basis for adjustment, ties to the US, and any issues (travel gaps, status gaps, criminal history) that require explanation. Strengthens complex cases.",
      required: false,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 400, maxWords: 900 },
        tone: "professional",
        mustAddress: [
          "Brief immigration history: when and how applicant entered the US",
          "Summary of the underlying petition and approval",
          "Description of ties to the US (family, employment, community)",
          "Explanation of any gaps in status, extended trips abroad, or prior immigration issues",
          "Statement of intent to reside permanently in the United States",
        ],
      },
    },
    {
      id: "rfe-response",
      title: "RFE / NOID Response Brief",
      kind: "petition-letter",
      description:
        "Legal response to a USCIS Request for Evidence or Notice of Intent to Deny. Addresses each deficiency point-by-point and submits additional evidence.",
      required: false,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 800, maxWords: 2500 },
        tone: "professional",
        mustAddress: [
          "Receipt number and applicant identification",
          "Point-by-point response to each issue raised in the RFE/NOID",
          "Legal citations and regulatory support for each position",
          "Description of newly submitted evidence for each deficiency",
          "Summary conclusion requesting approval",
        ],
      },
    },
  ],
};
