import { type PdfFieldMap, fmtDate, str, get, alienNum, ssnDigits } from "../engine";

// Section "applicant" → camelCase → "applicant"
// Section "eligibility-basis" → camelCase → "eligibilityBasis"
const S = "applicant";
const EB = "eligibilityBasis";

function addr(data: Record<string, unknown>) {
  return (get(data, S, "currentAddress") ?? {}) as Record<string, string>;
}

export const n400Map: PdfFieldMap = {
  formId: "n400",
  templateFile: "n-400.pdf",
  fields: {
    // ── Part 2: About You ──────────────────────────────────────────────────
    "form1[0].#subform[0].P2_Line1_FamilyName[0]": (d) => str(get(d, S, "familyName")),
    "form1[0].#subform[0].P2_Line1_GivenName[0]":  (d) => str(get(d, S, "givenName")),
    "form1[0].#subform[0].P2_Line1_MiddleName[0]": (d) => str(get(d, S, "middleName")),

    // Other name (name on green card / maiden)
    "form1[0].#subform[0].Line2_FamilyName1[0]": (d) => str(get(d, S, "otherFamilyName")),
    "form1[0].#subform[0].Line3_GivenName1[0]":  (d) => str(get(d, S, "otherGivenName")),

    // A-Number
    "form1[0].#subform[0].#area[0].Line1_AlienNumber[0]": (d) => alienNum(get(d, S, "alienNumber")),
    "form1[0].#subform[1].#area[1].Line1_AlienNumber[1]": (d) => alienNum(get(d, S, "alienNumber")),

    // USCIS account number
    "form1[0].#subform[1].P2_Line6_USCISELISAcctNumber[0]": (d) => str(get(d, S, "uscisOnlineAccount")),

    // DOB + sex + SSN
    "form1[0].#subform[1].P2_Line8_DateOfBirth[0]": (d) => fmtDate(get(d, S, "dob")),
    "form1[0].#subform[1].P2_Line7_Gender[0]": (d) => str(get(d, S, "sex")) === "male",
    "form1[0].#subform[1].P2_Line7_Gender[1]": (d) => str(get(d, S, "sex")) === "female",
    "form1[0].#subform[1].Line12b_SSN[0]": (d) => ssnDigits(get(d, S, "ssn")),

    // Date became LPR
    "form1[0].#subform[1].P2_Line9_DateBecamePermanentResident[0]": (d) =>
      fmtDate(get(d, S, "dateOfLPR")),

    // Country of birth + nationality
    "form1[0].#subform[1].P2_Line10_CountryOfBirth[0]":       (d) => str(get(d, S, "countryOfBirth")),
    "form1[0].#subform[1].P2_Line11_CountryOfNationality[0]": (d) => str(get(d, S, "countryOfCitizenship")),

    // Current address (Part 4)
    "form1[0].#subform[2].P4_Line3_PhysicalAddress1[0]": (d) => addr(d).street,
    "form1[0].#subform[2].P4_Line3_CityTown1[0]":        (d) => addr(d).city,
    "form1[0].#subform[2].P4_Line3_From1[0]":            (d) => addr(d).zip,

    // ── Part 1: Eligibility ─────────────────────────────────────────────────
    "form1[0].#subform[0].Part1_Eligibility[0]": (d) =>
      str(get(d, EB, "basis")) === "5year",
    "form1[0].#subform[0].Part1_Eligibility[1]": (d) =>
      str(get(d, EB, "basis")) === "3year-married",
    "form1[0].#subform[0].Part1_Eligibility[2]": (d) =>
      str(get(d, EB, "basis")) === "military",
  },
};
