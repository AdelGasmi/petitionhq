import { type PdfFieldMap, fmtDate, str, get, alienNum, ssnDigits } from "../engine";

// Section "applicant" → camelCase → "applicant"
// Section "eligibility" → camelCase → "eligibility"
// Section "travel" → camelCase → "travel"
const S = "applicant";
const E = "eligibility";

function addr(data: Record<string, unknown>) {
  return (get(data, S, "currentAddress") ?? {}) as Record<string, string>;
}

export const i765Map: PdfFieldMap = {
  formId: "i765",
  templateFile: "i-765.pdf",
  fields: {
    // ── Part 1: Name ────────────────────────────────────────────────────────
    "form1[0].Page1[0].Line1a_FamilyName[0]": (d) => str(get(d, S, "familyName")),
    "form1[0].Page1[0].Line1b_GivenName[0]":  (d) => str(get(d, S, "givenName")),
    "form1[0].Page1[0].Line1c_MiddleName[0]": (d) => str(get(d, S, "middleName")),

    // Other name used
    "form1[0].Page1[0].Line2a_FamilyName[0]": (d) => str(get(d, S, "otherFamilyName")),
    "form1[0].Page1[0].Line2b_GivenName[0]":  (d) => str(get(d, S, "otherGivenName")),

    // ── Part 2: Address ─────────────────────────────────────────────────────
    "form1[0].Page2[0].Line4b_StreetNumberName[0]": (d) => addr(d).street,
    "form1[0].Page2[0].Pt2Line5_CityOrTown[0]":     (d) => addr(d).city,
    "form1[0].Page2[0].Pt2Line5_State[0]":          (d) => addr(d).state,
    "form1[0].Page2[0].Pt2Line5_ZipCode[0]":        (d) => addr(d).zip,

    // A-Number + SSN + USCIS account
    "form1[0].Page2[0].Line7_AlienNumber[0]":   (d) => alienNum(get(d, S, "alienNumber")),
    "form1[0].Page2[0].Line12b_SSN[0]":         (d) => ssnDigits(get(d, S, "ssn")),
    "form1[0].Page2[0].Line8_ElisAccountNumber[0]": (d) => str(get(d, S, "uscisOnlineAccount")),

    // Sex (Male = [0], Female = [1])
    "form1[0].Page2[0].Line9_Checkbox[0]": (d) => str(get(d, S, "sex")) === "male",
    "form1[0].Page2[0].Line9_Checkbox[1]": (d) => str(get(d, S, "sex")) === "female",

    // ── Part 3: Eligibility & Entry ─────────────────────────────────────────
    "form1[0].Page3[0].Line19_DOB[0]": (d) => fmtDate(get(d, S, "dob")),
    "form1[0].Page3[0].Line18a_CityTownOfBirth[0]": (d) => str(get(d, S, "cityOfBirth")),
    "form1[0].Page3[0].Line18b_CityTownOfBirth[0]": (d) => str(get(d, S, "countryOfBirth")),
    "form1[0].Page3[0].Line18c_CountryOfBirth[0]":  (d) => str(get(d, S, "countryOfBirth")),

    // Current status / entry
    "form1[0].Page3[0].Line23_StatusLastEntry[0]": (d) => str(get(d, S, "currentStatus")),
    "form1[0].Page3[0].Line24_CurrentStatus[0]":   (d) => str(get(d, S, "currentStatus")),
    "form1[0].Page3[0].Line20a_I94Number[0]":      (d) => str(get(d, S, "i94Number")),
    "form1[0].Page3[0].Line21_DateOfLastEntry[0]": (d) => fmtDate(get(d, S, "lastEntryDate")),

    // I-485 receipt number (concurrent filing)
    "form1[0].Page3[0].Line28_ReceiptNumber[0]": (d) =>
      str(get(d, E, "i485ReceiptNumber")),

    // Eligibility category code (Part 3 section boxes)
    "form1[0].Page3[0].#area[1].section_1[0]": (d) => str(get(d, E, "category")),
  },
};
