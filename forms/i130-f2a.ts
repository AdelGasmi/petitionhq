import type { FormConfig } from "./types";

/**
 * I-130 F2A — Family petition by LPR for spouse/child.
 * Directly relevant: a Green Card holder petitioning their spouse.
 */
export const i130F2A: FormConfig = {
  id: "i130-f2a",
  formNumber: "I-130",
  title: "Petition for Alien Relative (F2A — Spouse/Child of LPR)",
  shortTitle: "I-130 F2A",
  category: "family-based",
  description:
    "Family-based petition filed by a Lawful Permanent Resident for their spouse or unmarried child under 21. The F2A preference category.",

  filingFee: {
    uscisFee: 675,
    notes: "Additional fees apply at the adjustment of status (I-485) or consular processing stage.",
  },

  processing: {
    serviceCenters: ["Chicago Lockbox", "Phoenix Lockbox"],
    medianMonths: 15,
    premiumEligible: false,
  },

  advisories: [
    "F2A is subject to annual visa limits. Check the Visa Bulletin for current priority dates.",
    "If the LPR naturalizes, the beneficiary upgrades to Immediate Relative (no wait).",
    "Beneficiary cannot file I-485 concurrently unless priority date is current.",
    "Evidence of bona fide marriage is critical — USCIS rejects many petitions for insufficient proof.",
  ],

  eligibility: [
    {
      id: "lpr-petitioner",
      label: "Petitioner is a Lawful Permanent Resident",
      explanation: "You must currently hold a green card.",
      severity: "must",
    },
    {
      id: "qualifying-relationship",
      label: "Valid spouse or unmarried child under 21",
      explanation: "F2A covers spouse of LPR or unmarried child under 21 of LPR.",
      severity: "must",
    },
    {
      id: "bona-fide-marriage",
      label: "Marriage is bona fide (if spouse case)",
      explanation: "Marriage must be entered in good faith, not for immigration benefits.",
      severity: "must",
    },
  ],

  sections: [
    {
      id: "petitioner",
      title: "Petitioner (LPR) Information",
      description: "Mirrors Part 2 of the I-130. Populates the pre-filled PDF directly.",
      fields: [
        { id: "familyName", type: "text", label: "Family name (last name)", required: true, uscisRef: "Part 2, Item 4a" },
        { id: "givenName", type: "text", label: "Given name (first name)", required: true, uscisRef: "Part 2, Item 4b" },
        { id: "middleName", type: "text", label: "Middle name", uscisRef: "Part 2, Item 4c" },
        { id: "sex", type: "select", label: "Sex", required: true, options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]},
        { id: "alienNumber", type: "alienNumber", label: "A-Number", required: true },
        { id: "ssn", type: "ssn", label: "SSN", required: true },
        { id: "dob", type: "date", label: "Date of birth", required: true, uscisRef: "Part 2, Item 8" },
        { id: "cityOfBirth", type: "text", label: "City/town of birth", required: true },
        { id: "countryOfBirth", type: "text", label: "Country of birth", required: true },
        { id: "currentAddress", type: "address", label: "Current US address", required: true, uscisRef: "Part 2, Item 10" },
        { id: "phone", type: "text", label: "Daytime phone number" },
        { id: "email", type: "text", label: "Email address" },
      ],
    },
    {
      id: "beneficiary",
      title: "Beneficiary (Spouse) Information",
      fields: [
        { id: "familyName", type: "text", label: "Beneficiary family name", required: true },
        { id: "givenName", type: "text", label: "Beneficiary given name", required: true },
        { id: "middleName", type: "text", label: "Beneficiary middle name" },
        { id: "sex", type: "select", label: "Sex", required: true, options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]},
        { id: "dob", type: "date", label: "Date of birth", required: true },
        { id: "cityOfBirth", type: "text", label: "City/town of birth", required: true },
        { id: "countryOfBirth", type: "text", label: "Country of birth", required: true },
        { id: "countryOfCitizenship", type: "text", label: "Country of citizenship", required: true },
        { id: "alienNumber", type: "alienNumber", label: "A-Number (if any)" },
        { id: "currentAddress", type: "address", label: "Current address", required: true, international: true },
        { id: "currentStatus", type: "select", label: "Current US status (if in US)", options: [
          { value: "f1", label: "F-1" },
          { value: "f2", label: "F-2" },
          { value: "h1b", label: "H-1B" },
          { value: "h4", label: "H-4" },
          { value: "other", label: "Other" },
          { value: "outside", label: "Outside the US" },
        ]},
      ],
    },
    {
      id: "marriage",
      title: "Marriage Details",
      fields: [
        { id: "marriageDate", type: "date", label: "Date of marriage", required: true },
        { id: "marriageCountry", type: "text", label: "Country where married", required: true },
        { id: "marriageCity", type: "text", label: "City where married", required: true },
        { id: "priorMarriagesPetitioner", type: "number", label: "Petitioner's prior marriages", min: 0 },
        { id: "priorMarriagesBeneficiary", type: "number", label: "Beneficiary's prior marriages", min: 0 },
      ],
    },
  ],

  documents: [
    { id: "petitioner-green-card", title: "Petitioner's green card (both sides)", description: "Proof of LPR status.", required: true },
    { id: "marriage-certificate", title: "Marriage certificate", description: "Official government-issued.", required: true },
    { id: "prior-divorce-decrees", title: "Prior divorce decrees or death certificates", description: "For both petitioner and beneficiary, if applicable.", required: false },
    { id: "beneficiary-passport", title: "Beneficiary passport biographic page", description: "", required: true },
    { id: "beneficiary-birth-cert", title: "Beneficiary birth certificate", description: "With certified translation if not in English.", required: true },
    { id: "bona-fide-joint-lease", title: "Joint lease or mortgage", description: "Showing both names.", required: false, supports: ["bona-fide-evidence"] },
    { id: "bona-fide-joint-bank", title: "Joint bank/credit accounts", description: "Statements showing both names and activity.", required: false, supports: ["bona-fide-evidence"] },
    { id: "bona-fide-joint-insurance", title: "Joint insurance policies", description: "Health, auto, life.", required: false, supports: ["bona-fide-evidence"] },
    { id: "bona-fide-photos", title: "Photos together", description: "Across a range of dates and contexts — wedding, family events, travel, daily life.", required: true, supports: ["bona-fide-evidence"] },
    { id: "bona-fide-communications", title: "Communication records", description: "Messages, call logs, travel together.", required: false, supports: ["bona-fide-evidence"] },
    { id: "bona-fide-affidavits", title: "Affidavits from friends/family", description: "Sworn statements attesting to the relationship.", required: false, supports: ["bona-fide-evidence"] },
  ],

  letters: [
    {
      id: "bona-fide-affidavit",
      title: "Bona Fide Marriage Affidavit",
      kind: "affidavit",
      description:
        "Sworn statement from a friend or family member who knows the couple, attesting to the authenticity of the relationship.",
      required: false,
      minCount: 2,
      maxCount: 4,
      recommenderProfile: [
        { id: "name", type: "text", label: "Affiant's full name", required: true },
        { id: "relationship", type: "textarea", label: "Relationship to the couple", required: true },
        { id: "yearsKnown", type: "number", label: "Years known to the couple" },
        { id: "address", type: "address", label: "Affiant address", required: true },
      ],
      draftingHints: {
        targetLength: { minWords: 400, maxWords: 800 },
        tone: "personal",
        mustAddress: [
          "How the affiant knows the couple",
          "Specific events the affiant witnessed (gatherings, daily life, shared activities)",
          "Observations about the authenticity of the relationship",
          "Affiant's personal details and sworn statement",
        ],
      },
    },
  ],
};
