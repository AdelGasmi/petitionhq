import type { FormConfig } from "./types";

/**
 * N-400 Naturalization — becoming a US citizen.
 * Stub config showing the form engine handles naturalization flows.
 */
export const n400: FormConfig = {
  id: "n400",
  formNumber: "N-400",
  title: "Application for Naturalization",
  shortTitle: "Naturalization",
  category: "naturalization",
  description:
    "Application to become a US citizen. Requires continuous residence, physical presence, good moral character, and civics/English proficiency.",

  filingFee: {
    uscisFee: 760,
    biometricsFee: 85,
    notes: "Reduced fee of $380 available for incomes between 150-400% of Federal Poverty Guidelines.",
  },

  processing: {
    serviceCenters: ["Local USCIS Field Office"],
    medianMonths: 8,
    premiumEligible: false,
  },

  advisories: [
    "File no earlier than 90 days before meeting the continuous residence requirement.",
    "Any trip outside the US longer than 6 months may break continuous residence.",
    "Certain criminal history permanently or temporarily bars naturalization — review carefully.",
  ],

  eligibility: [
    {
      id: "lpr-status",
      label: "Lawful Permanent Resident for required period",
      explanation: "5 years as an LPR (or 3 years if married to a US citizen for the full 3 years and living in marital union).",
      severity: "must",
    },
    {
      id: "continuous-residence",
      label: "Continuous residence in the US",
      explanation: "Maintained continuous residence for the required period. Trips over 6 months can break this.",
      severity: "must",
    },
    {
      id: "physical-presence",
      label: "Physical presence in the US (half the statutory period)",
      explanation: "Physically present in the US for at least 30 months in the 5-year period (or 18 months in the 3-year period).",
      severity: "must",
    },
    {
      id: "good-moral-character",
      label: "Good moral character",
      explanation: "No disqualifying criminal record, tax compliance, no false claims to citizenship or voter fraud.",
      severity: "must",
    },
    {
      id: "english-civics",
      label: "English and civics proficiency",
      explanation: "Must pass reading, writing, and speaking English plus a civics test. Exemptions for age/disability.",
      severity: "must",
    },
  ],

  sections: [
    {
      id: "applicant",
      title: "Applicant Information",
      description: "Mirrors Part 2 of the N-400. Populates the pre-filled PDF directly.",
      fields: [
        // ── Name ──────────────────────────────────────────────────────────
        { id: "familyName", type: "text", label: "Family name (last name)", required: true, uscisRef: "Part 2, Item 1a" },
        { id: "givenName", type: "text", label: "Given name (first name)", required: true, uscisRef: "Part 2, Item 1b" },
        { id: "middleName", type: "text", label: "Middle name", uscisRef: "Part 2, Item 1c" },
        { id: "otherFamilyName", type: "text", label: "Other family name used (name on green card, maiden, alias)", uscisRef: "Part 2, Item 2" },
        { id: "otherGivenName", type: "text", label: "Other given name used" },
        // ── Personal ──────────────────────────────────────────────────────
        { id: "sex", type: "select", label: "Sex", required: true, options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]},
        { id: "dob", type: "date", label: "Date of birth", required: true, uscisRef: "Part 2, Item 8" },
        { id: "cityOfBirth", type: "text", label: "City/town of birth", required: true },
        { id: "countryOfBirth", type: "text", label: "Country of birth", required: true, uscisRef: "Part 2, Item 10" },
        { id: "countryOfCitizenship", type: "text", label: "Current country of nationality/citizenship", required: true, uscisRef: "Part 2, Item 11" },
        // ── IDs ───────────────────────────────────────────────────────────
        { id: "alienNumber", type: "alienNumber", label: "A-Number", required: true, uscisRef: "Part 2" },
        { id: "uscisOnlineAccount", type: "text", label: "USCIS Online Account Number (if any)" },
        { id: "ssn", type: "ssn", label: "SSN", required: true, uscisRef: "Part 2, Item 12b" },
        // ── LPR info ──────────────────────────────────────────────────────
        { id: "dateOfLPR", type: "date", label: "Date you became a Permanent Resident", required: true, uscisRef: "Part 2, Item 9" },
        // ── Address ───────────────────────────────────────────────────────
        { id: "currentAddress", type: "address", label: "Current home address", required: true },
        // ── Contact ───────────────────────────────────────────────────────
        { id: "phone", type: "text", label: "Daytime phone number" },
        { id: "email", type: "text", label: "Email address" },
      ],
    },
    {
      id: "eligibility-basis",
      title: "Basis for Naturalization",
      fields: [
        { id: "basis", type: "select", label: "Basis", required: true, options: [
          { value: "5year", label: "5 years as LPR" },
          { value: "3year-married", label: "3 years as LPR + married to US citizen" },
          { value: "military", label: "Military service" },
          { value: "other", label: "Other" },
        ]},
      ],
    },
    {
      id: "residence-history",
      title: "Residence and Travel History",
      fields: [
        {
          id: "addresses",
          type: "repeatable",
          label: "All US addresses (past 5 years)",
          itemLabel: "Address",
          fields: [
            { id: "address", type: "address", label: "Address", required: true },
            { id: "from", type: "date", label: "From", required: true },
            { id: "to", type: "date", label: "To" },
          ],
        },
        {
          id: "trips",
          type: "repeatable",
          label: "All trips outside the US (past 5 years)",
          itemLabel: "Trip",
          fields: [
            { id: "departureDate", type: "date", label: "Departure date", required: true },
            { id: "returnDate", type: "date", label: "Return date", required: true },
            { id: "destinations", type: "text", label: "Countries visited", required: true },
            { id: "reason", type: "text", label: "Reason for trip" },
          ],
        },
      ],
    },
  ],

  documents: [
    { id: "green-card", title: "Permanent Resident Card (both sides)", description: "Copy of front and back of current green card.", required: true },
    { id: "passport-bio", title: "Passport biographic page", description: "Any passports held during the statutory period.", required: true },
    { id: "tax-returns", title: "Tax returns", description: "Last 5 years (or 3 if marriage-based).", required: true },
    { id: "marriage-cert", title: "Marriage certificate", description: "If filing on marriage basis.", required: false },
    { id: "spouse-citizenship", title: "Spouse's proof of US citizenship", description: "If filing on marriage basis.", required: false },
    { id: "selective-service", title: "Selective Service registration", description: "For males who lived in US between 18-26.", required: false },
    { id: "court-dispositions", title: "Certified court dispositions", description: "For any arrests or citations, even if dismissed.", required: false },
  ],

  letters: [
    {
      id: "cover-letter",
      title: "Filing Cover Letter",
      kind: "petition-letter",
      description:
        "Transmittal letter to USCIS introducing the applicant, stating the basis for naturalization, listing all enclosed documents, and requesting approval. Standard for all organized N-400 filings.",
      required: true,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 400, maxWords: 800 },
        tone: "professional",
        mustAddress: [
          "Applicant's full name, A-Number, and green card date",
          "Statutory basis (5-year or 3-year marriage-based)",
          "Physical presence calculation summary",
          "Itemized list of all enclosed documents",
          "Any concurrent requests (name change, disability accommodations)",
        ],
      },
    },
    {
      id: "personal-statement",
      title: "Personal Statement for Naturalization",
      kind: "petition-letter",
      description:
        "Narrative statement by the applicant explaining their journey to permanent residence, commitment to the United States, and addressing any issues that may arise during adjudication (travel history, prior criminal matters, tax issues).",
      required: false,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 400, maxWords: 800 },
        tone: "professional",
        mustAddress: [
          "Brief personal background and how applicant became an LPR",
          "Summary of residence in the US — community ties, employment, family",
          "Physical presence summary and explanation of any long trips abroad",
          "Good moral character statement: tax compliance, no criminal history (or explanation of any issues)",
          "Statement of attachment to the principles of the US Constitution",
        ],
      },
    },
    {
      id: "travel-explanation",
      title: "Extended Travel Explanation Letter",
      kind: "petition-letter",
      description:
        "Letter explaining trips outside the US exceeding 6 months, demonstrating that continuous residence was maintained. Required when any single trip exceeds 6 months.",
      required: false,
      minCount: 1,
      maxCount: 3,
      draftingHints: {
        targetLength: { minWords: 300, maxWords: 700 },
        tone: "professional",
        mustAddress: [
          "Dates of departure and return for the specific trip",
          "Reason for the extended trip (medical, family emergency, employment abroad)",
          "Evidence of maintained US ties during absence (rent/mortgage, job held, US bank accounts, family in US)",
          "Steps taken to return as soon as circumstances allowed",
        ],
      },
    },
    {
      id: "good-moral-character",
      title: "Good Moral Character Explanatory Letter",
      kind: "petition-letter",
      description:
        "Letter addressing any arrests, citations, tax issues, or other matters that USCIS will scrutinize during the good moral character assessment. Submitted proactively with court dispositions.",
      required: false,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 300, maxWords: 800 },
        tone: "professional",
        mustAddress: [
          "Factual description of the incident(s) at issue",
          "Outcome of any legal proceedings (charges dismissed, fine paid, probation completed)",
          "Rehabilitation and changed circumstances since the incident",
          "Statement of compliance with all legal obligations going forward",
        ],
      },
    },
  ],
};
