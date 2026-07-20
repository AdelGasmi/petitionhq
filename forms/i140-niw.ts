import type { FormConfig } from "./types";

/**
 * I-140 NIW EB-2 — National Interest Waiver.
 *
 * This is the deepest config because NIW is the most drafting-heavy case and
 * also the one where the platform provides the most value (versus attorneys).
 * The three-prong Dhanasar framework is the backbone of everything here.
 */
export const i140Niw: FormConfig = {
  id: "i140-niw",
  formNumber: "I-140",
  title: "Immigrant Petition for Alien Worker — EB-2 National Interest Waiver",
  shortTitle: "NIW EB-2",
  category: "employment-based",
  description:
    "Self-petition for employment-based green card where the applicant's work is in the national interest of the US, waiving the labor certification requirement.",

  filingFee: {
    uscisFee: 715,
    premiumProcessingFee: 2805,
    notes: "Premium processing available as of 2023 for NIW petitions.",
  },

  processing: {
    serviceCenters: ["Nebraska Service Center", "Texas Service Center"],
    medianMonths: 10,
    premiumEligible: true,
    premiumDays: 45,
  },

  advisories: [
    "The NIW standard was set by Matter of Dhanasar (2016). All evidence and arguments must map to its three prongs.",
    "Self-petition means you are both the petitioner and beneficiary. You do not need an employer.",
  ],

  // -------------------------------------------------------------------------
  // Eligibility — Dhanasar three-prong test
  // -------------------------------------------------------------------------
  eligibility: [
    {
      id: "eb2-baseline",
      label: "Qualifies for EB-2 (advanced degree OR exceptional ability)",
      explanation:
        "You must first meet the underlying EB-2 criteria: either hold a US advanced degree (or foreign equivalent) OR show exceptional ability in sciences, arts, or business.",
      severity: "must",
    },
    {
      id: "dhanasar-1",
      label: "Prong 1 — Substantial merit and national importance",
      explanation:
        "Your proposed endeavor must have both substantial merit AND national importance. Merit can be shown in any field; national importance requires broader implications beyond a single employer or locality.",
      severity: "must",
      framework: { name: "Matter of Dhanasar", prong: "1" },
    },
    {
      id: "dhanasar-2",
      label: "Prong 2 — Well positioned to advance the endeavor",
      explanation:
        "Your education, skills, record of success, and concrete plan must show you are well positioned to actually advance the endeavor.",
      severity: "must",
      framework: { name: "Matter of Dhanasar", prong: "2" },
    },
    {
      id: "dhanasar-3",
      label: "Prong 3 — Beneficial to waive labor certification",
      explanation:
        "On balance, it would benefit the US to waive the job offer / labor certification requirement. Typically shown by urgency, impracticality of labor cert, or the applicant's unique contribution.",
      severity: "must",
      framework: { name: "Matter of Dhanasar", prong: "3" },
    },
  ],

  // -------------------------------------------------------------------------
  // Form sections — mirrors the actual I-140 structure
  // -------------------------------------------------------------------------
  sections: [
    {
      id: "petitioner-info",
      title: "Petitioner Information",
      description: "For self-petition NIW, you are both the petitioner and beneficiary. Fill every field — this populates Parts 1 and 3 of the I-140.",
      fields: [
        // ── Name ──────────────────────────────────────────────────────────
        { id: "familyName", type: "text", label: "Family name (last name)", required: true, uscisRef: "Part 3, Item 1a" },
        { id: "givenName", type: "text", label: "Given name (first name)", required: true, uscisRef: "Part 3, Item 1b" },
        { id: "middleName", type: "text", label: "Middle name", uscisRef: "Part 3, Item 1c" },
        { id: "otherFamilyName", type: "text", label: "Other family name used (maiden, alias)", uscisRef: "Part 3, Item 2a" },
        { id: "otherGivenName", type: "text", label: "Other given name used", uscisRef: "Part 3, Item 2b" },
        // ── Personal ──────────────────────────────────────────────────────
        { id: "sex", type: "select", label: "Sex", required: true, options: [
          { value: "male", label: "Male" },
          { value: "female", label: "Female" },
        ]},
        { id: "dob", type: "date", label: "Date of birth", required: true, uscisRef: "Part 3, Item 4" },
        { id: "cityOfBirth", type: "text", label: "City/town of birth", required: true, uscisRef: "Part 3, Item 5a" },
        { id: "stateOfBirth", type: "text", label: "State/province of birth (if applicable)" },
        { id: "countryOfBirth", type: "text", label: "Country of birth", required: true, uscisRef: "Part 3, Item 5b" },
        { id: "countryOfCitizenship", type: "text", label: "Country of citizenship/nationality", required: true, uscisRef: "Part 3, Item 6" },
        // ── IDs ───────────────────────────────────────────────────────────
        { id: "alienNumber", type: "alienNumber", label: "A-Number (if any)", uscisRef: "Part 3, Item 8" },
        { id: "uscisOnlineAccount", type: "text", label: "USCIS Online Account Number (if any)" },
        { id: "ssn", type: "ssn", label: "US SSN (if any)" },
        // ── Address ───────────────────────────────────────────────────────
        { id: "currentAddress", type: "address", label: "Current US mailing address", required: true },
        // ── Contact ───────────────────────────────────────────────────────
        { id: "phone", type: "text", label: "Daytime phone number" },
        { id: "email", type: "text", label: "Email address" },
        // ── Current status / entry ────────────────────────────────────────
        { id: "currentStatus", type: "text", label: "Current nonimmigrant status (e.g. H-1B, F-1, O-1)", help: "Leave blank if already an LPR or if status expired." },
        { id: "lastEntryDate", type: "date", label: "Date of last entry into the US" },
        { id: "i94Number", type: "text", label: "I-94 Arrival-Departure Record Number" },
        // ── Passport ─────────────────────────────────────────────────────
        { id: "passportNumber", type: "text", label: "Passport number" },
        { id: "passportCountry", type: "text", label: "Passport issuing country" },
        { id: "passportExpiry", type: "date", label: "Passport expiration date" },
      ],
    },
    {
      id: "endeavor",
      title: "Proposed Endeavor",
      description:
        "Describe the specific work you propose to do in the US. This directly drives Dhanasar Prong 1. Be concrete — 'advancing semiconductor supply chain resilience in the US' beats 'doing research in electrical engineering.'",
      fields: [
        {
          id: "endeavorStatement",
          type: "textarea",
          label: "Proposed endeavor (2-4 sentences)",
          required: true,
          maxLength: 600,
          help: "What will you actually do? In what field? To what end?",
        },
        {
          id: "endeavorField",
          type: "text",
          label: "Field / sub-field",
          required: true,
        },
        {
          id: "nationalImportanceArgument",
          type: "textarea",
          label: "Why is this nationally important?",
          required: true,
          help: "Connect to national priorities: CHIPS Act, climate goals, public health, AI competitiveness, defense, critical minerals, etc. Cite specific federal initiatives where possible.",
        },
      ],
    },
    {
      id: "qualifications",
      title: "Qualifications & Track Record",
      fields: [
        { id: "highestDegree", type: "select", label: "Highest degree", required: true, options: [
          { value: "phd", label: "PhD / Doctorate" },
          { value: "md", label: "MD / Medical degree" },
          { value: "masters", label: "Master's" },
          { value: "bachelors+5", label: "Bachelor's + 5 yrs progressive experience" },
          { value: "exceptional-ability", label: "Exceptional ability (no advanced degree)" },
        ]},
        {
          id: "publications",
          type: "repeatable",
          label: "Publications",
          itemLabel: "Publication",
          fields: [
            { id: "title", type: "text", label: "Title", required: true },
            { id: "venue", type: "text", label: "Journal / venue" },
            { id: "year", type: "number", label: "Year", min: 1950, max: 2030 },
            { id: "citations", type: "number", label: "Citation count", min: 0 },
            { id: "role", type: "select", label: "Your role", options: [
              { value: "first-author", label: "First author" },
              { value: "corresponding", label: "Corresponding author" },
              { value: "co-author", label: "Co-author" },
              { value: "senior", label: "Senior author" },
            ]},
          ],
        },
        {
          id: "awards",
          type: "repeatable",
          label: "Awards & recognition",
          itemLabel: "Award",
          fields: [
            { id: "name", type: "text", label: "Award name", required: true },
            { id: "issuer", type: "text", label: "Issuing organization" },
            { id: "year", type: "number", label: "Year" },
            { id: "significance", type: "textarea", label: "Significance (why this matters)" },
          ],
        },
        {
          id: "grants",
          type: "repeatable",
          label: "Grants & funding",
          itemLabel: "Grant",
          fields: [
            { id: "title", type: "text", label: "Grant / project title", required: true },
            { id: "agency", type: "text", label: "Funding agency (NIH, NSF, DOE, etc.)" },
            { id: "amount", type: "text", label: "Award amount (e.g. $500,000)" },
            { id: "year", type: "number", label: "Year awarded" },
            { id: "role", type: "select", label: "Your role", options: [
              { value: "pi", label: "Principal Investigator (PI)" },
              { value: "co-pi", label: "Co-Principal Investigator" },
              { value: "co-i", label: "Co-Investigator" },
              { value: "key-personnel", label: "Key Personnel" },
            ]},
          ],
        },
        {
          id: "patents",
          type: "repeatable",
          label: "Patents",
          itemLabel: "Patent",
          fields: [
            { id: "title", type: "text", label: "Patent title", required: true },
            { id: "number", type: "text", label: "Patent / application number" },
            { id: "year", type: "number", label: "Year granted / filed" },
            { id: "status", type: "select", label: "Status", options: [
              { value: "granted", label: "Granted" },
              { value: "pending", label: "Pending" },
              { value: "licensed", label: "Granted & licensed" },
            ]},
          ],
        },
        {
          id: "mediaCoverage",
          type: "repeatable",
          label: "Media coverage",
          itemLabel: "Coverage",
          fields: [
            { id: "outlet", type: "text", label: "Outlet / publication", required: true },
            { id: "title", type: "text", label: "Article title" },
            { id: "year", type: "number", label: "Year" },
            { id: "reach", type: "text", label: "Audience / reach (e.g. 2M monthly readers)" },
          ],
        },
        {
          id: "invitedTalks",
          type: "repeatable",
          label: "Invited talks & keynotes",
          itemLabel: "Talk",
          fields: [
            { id: "title", type: "text", label: "Talk title / topic", required: true },
            { id: "venue", type: "text", label: "Conference / institution" },
            { id: "year", type: "number", label: "Year" },
            { id: "kind", type: "select", label: "Type", options: [
              { value: "keynote", label: "Keynote" },
              { value: "invited", label: "Invited talk" },
              { value: "seminar", label: "Seminar" },
              { value: "panel", label: "Panel" },
            ]},
          ],
        },
        {
          id: "editorialRoles",
          type: "repeatable",
          label: "Peer review & editorial roles",
          itemLabel: "Role",
          fields: [
            { id: "journal", type: "text", label: "Journal / conference", required: true },
            { id: "role", type: "select", label: "Role", options: [
              { value: "editor", label: "Editor / Associate Editor" },
              { value: "reviewer", label: "Peer Reviewer" },
              { value: "program-committee", label: "Program Committee" },
              { value: "advisory-board", label: "Advisory Board" },
            ]},
            { id: "year", type: "number", label: "Since (year)" },
          ],
        },
      ],
    },
  ],

  // -------------------------------------------------------------------------
  // Documents — every piece of evidence needed, tagged to Dhanasar prongs
  // -------------------------------------------------------------------------
  documents: [
    // Identity / baseline
    {
      id: "passport",
      title: "Passport (biographic page)",
      description: "Current passport showing your photo, name, and expiration.",
      required: true,
      accept: [".pdf", ".jpg", ".png"],
      validation: [{ kind: "must-contain", detail: "Passport number, expiration date, photo" }],
    },
    {
      id: "i94",
      title: "I-94 Arrival/Departure Record",
      description: "Most recent I-94 from the CBP website.",
      required: true,
      accept: [".pdf"],
    },
    {
      id: "diplomas",
      title: "Diplomas and transcripts (with translations if not in English)",
      description: "All degrees. Foreign degrees need credential evaluation.",
      required: true,
      accept: [".pdf"],
      validation: [{ kind: "translated", detail: "Certified translation required for non-English documents" }],
    },
    {
      id: "credential-eval",
      title: "Credential evaluation (for foreign degrees)",
      description: "Evaluation from a NACES member showing US equivalency of any foreign degree.",
      required: false,
    },

    // Prong 1 evidence
    {
      id: "endeavor-documentation",
      title: "Documentation of the endeavor's national importance",
      description: "News articles, government reports, agency priorities, funding programs that show the field matters to the US.",
      required: true,
      prong: "1",
      supports: ["petition-letter"],
    },

    // Prong 2 evidence — "well positioned"
    {
      id: "cv",
      title: "Complete CV / Resume",
      description: "Comprehensive CV listing education, positions, publications, awards, grants, patents, invited talks.",
      required: true,
      prong: "2",
      extractable: true,
      accept: [".pdf", ".docx"],
    },
    {
      id: "publication-pdfs",
      title: "Full-text PDFs of key publications",
      description: "At least 3-5 of your most cited or most impactful papers.",
      required: false,
      prong: "2",
    },
    {
      id: "citation-reports",
      title: "Citation reports",
      description: "Google Scholar profile + Scopus or Web of Science citation reports.",
      required: true,
      prong: "2",
    },
    {
      id: "grants-funding",
      title: "Grant and funding documentation",
      description: "NIH/NSF/DOD/DOE grants received or participated in. Include award letters.",
      required: false,
      prong: "2",
    },
    {
      id: "patents",
      title: "Patents (granted or filed)",
      description: "USPTO or international patent documents.",
      required: false,
      prong: "2",
    },
    {
      id: "media-coverage",
      title: "Media coverage of your work",
      description: "Articles in major outlets, press releases, interviews.",
      required: false,
      prong: "2",
    },
    {
      id: "peer-review",
      title: "Peer review invitations",
      description: "Emails or records showing you have reviewed for journals/conferences.",
      required: false,
      prong: "2",
    },

    // Prong 3 evidence
    {
      id: "labor-cert-impracticality",
      title: "Evidence that labor certification is impractical/insufficient",
      description: "Hiring data, shortage occupation reports, or explanation of why your unique contribution cannot be replaced by a labor-certified hire.",
      required: false,
      prong: "3",
    },
  ],

  // -------------------------------------------------------------------------
  // Letters — petition brief + recommendation letters
  // -------------------------------------------------------------------------
  letters: [
    {
      id: "petition-letter",
      title: "Petition Letter (Legal Brief)",
      kind: "petition-letter",
      description:
        "The master legal brief arguing why you meet the Dhanasar three-prong test. Written in your voice (self-petition) or your attorney's voice. Typically 15–30 pages.",
      required: true,
      minCount: 1,
      maxCount: 1,
      draftingHints: {
        targetLength: { minWords: 4000, maxWords: 8000 },
        tone: "professional",
        framework: "Dhanasar",
        mustAddress: [
          "Introduction and summary of argument — who you are and preview of all three prongs",
          "EB-2 baseline qualifications (advanced degree or exceptional ability)",
          "Prong 1 — Substantial merit of the proposed endeavor",
          "Prong 1 — National importance with specific federal initiative or public health data",
          "Prong 2 — Well positioned: education, track record, awards, concrete US plan",
          "Prong 3 — Beneficial to waive labor certification: urgency, impracticality, unique qualifications",
          "Conclusion requesting approval",
        ],
      },
    },
    {
      id: "rec-independent",
      title: "Independent Recommendation Letter",
      kind: "recommendation-independent",
      description:
        "A recommender who has NOT worked with you directly, but knows your work through your publications or reputation. Independent letters carry the most weight.",
      required: true,
      minCount: 3,
      maxCount: 6,
      recommenderProfile: [
        { id: "name", type: "text", label: "Recommender's full name", required: true },
        { id: "title", type: "text", label: "Current title", required: true },
        { id: "institution", type: "text", label: "Institution / organization", required: true },
        { id: "credentials", type: "textarea", label: "Key credentials (awards, publications, positions)", required: true },
        { id: "relationship", type: "textarea", label: "How do they know your work?", required: true, help: "For independent: through your publications, conferences, reputation. They have NOT co-authored or advised you." },
        { id: "country", type: "text", label: "Country", required: true },
        { id: "email", type: "email", label: "Email" },
      ],
      draftingHints: {
        targetLength: { minWords: 700, maxWords: 1200 },
        tone: "academic",
        framework: "Dhanasar",
        mustAddress: [
          "Recommender's own qualifications and why their opinion is authoritative",
          "How they became familiar with the applicant's work",
          "Specific contribution(s) of the applicant that advance the field",
          "Substantial merit of the applicant's work (Prong 1)",
          "National importance / broader impact (Prong 1)",
          "Applicant's track record of success (Prong 2)",
          "Why the applicant is uniquely positioned to advance the endeavor (Prong 2)",
          "Why waiving labor cert is beneficial (Prong 3) — if the recommender can credibly speak to this",
        ],
      },
    },
    {
      id: "rec-dependent",
      title: "Dependent Recommendation Letter",
      kind: "recommendation-dependent",
      description:
        "A recommender who has worked with you directly — advisor, PI, supervisor, close collaborator. Provides depth on your actual work quality.",
      required: true,
      minCount: 1,
      maxCount: 3,
      recommenderProfile: [
        { id: "name", type: "text", label: "Recommender's full name", required: true },
        { id: "title", type: "text", label: "Current title", required: true },
        { id: "institution", type: "text", label: "Institution", required: true },
        { id: "credentials", type: "textarea", label: "Key credentials", required: true },
        { id: "relationship", type: "textarea", label: "Nature of working relationship", required: true },
        { id: "yearsKnown", type: "number", label: "Years you've worked together", min: 0 },
      ],
      draftingHints: {
        targetLength: { minWords: 800, maxWords: 1500 },
        tone: "academic",
        framework: "Dhanasar",
        mustAddress: [
          "Recommender's direct observation of the applicant's work",
          "Specific projects, contributions, and outcomes",
          "Technical depth and originality of applicant's work",
          "National importance of the research program",
          "Applicant's trajectory and future potential",
        ],
      },
    },
  ],

  // -------------------------------------------------------------------------
  // Narratives — the petition letter itself
  // -------------------------------------------------------------------------
  narratives: [
    {
      id: "petition-letter",
      title: "Petition Letter (Brief)",
      description:
        "The master legal brief arguing why the applicant meets Dhanasar. Typically 15-30 pages. Written in the applicant's voice (self-petition) or attorney's voice.",
      targetLength: { minWords: 4000, maxWords: 8000 },
      outline: [
        {
          id: "intro",
          heading: "Introduction & Summary of Argument",
          guidance:
            "State who the petitioner is, what the endeavor is, and preview the three-prong argument. 1-2 pages.",
        },
        {
          id: "petitioner-qualifications",
          heading: "Petitioner's Qualifications",
          guidance:
            "Establish EB-2 baseline (advanced degree or exceptional ability) with credential evaluation reference.",
          evidenceRefs: ["diplomas", "credential-eval", "cv"],
        },
        {
          id: "prong1-merit",
          heading: "Prong 1 — Substantial Merit of the Proposed Endeavor",
          guidance:
            "Argue the endeavor has substantial merit in its field. Use publications, awards, and expert opinions. Quote recommendation letters.",
          evidenceRefs: ["publication-pdfs", "citation-reports", "awards"],
        },
        {
          id: "prong1-importance",
          heading: "Prong 1 — National Importance",
          guidance:
            "Connect the endeavor to specific US national priorities. Cite federal agency strategy documents, CHIPS Act, Climate goals, NIH initiatives, etc.",
          evidenceRefs: ["endeavor-documentation"],
        },
        {
          id: "prong2",
          heading: "Prong 2 — Petitioner is Well Positioned to Advance the Endeavor",
          guidance:
            "Education, skills, published work, funding history, plans for US work. Quote dependent recommendation letters heavily here.",
          evidenceRefs: ["cv", "publication-pdfs", "grants-funding", "patents"],
        },
        {
          id: "prong3",
          heading: "Prong 3 — Beneficial to Waive the Labor Certification",
          guidance:
            "Argue the balance of equities favors waiver. Key arguments: urgency of the endeavor, impracticality of identifying a specific employer, applicant's unique qualifications not replaceable by labor cert.",
          evidenceRefs: ["labor-cert-impracticality"],
        },
        {
          id: "conclusion",
          heading: "Conclusion",
          guidance: "Request approval, summarize the argument in 2-3 paragraphs.",
        },
      ],
    },
  ],
};
