import { type PdfFieldMap, fmtDate, str, get, alienNum, ssnDigits } from "../engine";

// Section "petitioner" → camelCase → "petitioner"
// Section "beneficiary" → camelCase → "beneficiary"
// Section "relationship" → camelCase → "relationship"
const P = "petitioner";
const B = "beneficiary";
const R = "relationship";

function pAddr(data: Record<string, unknown>) {
  return (get(data, P, "currentAddress") ?? {}) as Record<string, string>;
}
function bAddr(data: Record<string, unknown>) {
  return (get(data, B, "currentAddress") ?? {}) as Record<string, string>;
}

export const i130Map: PdfFieldMap = {
  formId: "i130-f2a",
  templateFile: "i-130.pdf",
  fields: {
    // ── Part 2: Petitioner ─────────────────────────────────────────────────
    "form1[0].#subform[0].Pt2Line4a_FamilyName[0]": (d) => str(get(d, P, "familyName")),
    "form1[0].#subform[0].Pt2Line4b_GivenName[0]":  (d) => str(get(d, P, "givenName")),
    "form1[0].#subform[0].Pt2Line4c_MiddleName[0]": (d) => str(get(d, P, "middleName")),

    // Petitioner A-Number + SSN
    "form1[0].#subform[0].#area[4].Pt2Line1_AlienNumber[0]": (d) => alienNum(get(d, P, "alienNumber")),
    "form1[0].#subform[0].Pt2Line11_SSN[0]": (d) => ssnDigits(get(d, P, "ssn")),

    // Petitioner sex
    "form1[0].#subform[1].Pt2Line9_Male[0]":   (d) => str(get(d, P, "sex")) === "male",
    "form1[0].#subform[1].Pt2Line9_Female[0]": (d) => str(get(d, P, "sex")) === "female",

    // Petitioner DOB + country of birth
    "form1[0].#subform[1].Pt2Line8_DateofBirth[0]":  (d) => fmtDate(get(d, P, "dob")),
    "form1[0].#subform[1].Pt2Line7_CountryofBirth[0]": (d) => str(get(d, P, "countryOfBirth")),

    // Petitioner current address
    "form1[0].#subform[1].Pt2Line10_StreetNumberName[0]": (d) => pAddr(d).street,
    "form1[0].#subform[1].Pt2Line10_CityOrTown[0]":       (d) => pAddr(d).city,
    "form1[0].#subform[1].Pt2Line10_State[0]":            (d) => pAddr(d).state,
    "form1[0].#subform[1].Pt2Line10_ZipCode[0]":          (d) => pAddr(d).zip,

    // ── Part 3: Beneficiary ────────────────────────────────────────────────
    "form1[0].#subform[2].Line3a_FamilyName2[0]": (d) => str(get(d, B, "familyName")),
    "form1[0].#subform[2].Line3b_GivenName2[0]":  (d) => str(get(d, B, "givenName")),
    "form1[0].#subform[2].Line3c_MiddleName2[0]": (d) => str(get(d, B, "middleName")),

    "form1[0].#subform[2].Line3f_CityOrTown[0]": (d) => bAddr(d).city,
    "form1[0].#subform[2].Line3i_Country[0]":    (d) => str(get(d, B, "countryOfBirth")),

    // ── Part 1: Relationship type ──────────────────────────────────────────
    "form1[0].#subform[0].Pt1Line1_Spouse[0]":   (d) => str(get(d, R, "relationship")) === "spouse",
    "form1[0].#subform[0].Pt1Line1_Child[0]":    (d) => str(get(d, R, "relationship")) === "child",
    "form1[0].#subform[0].Pt1Line1_Parent[0]":   (d) => str(get(d, R, "relationship")) === "parent",
    "form1[0].#subform[0].Pt1Line1_Siblings[0]": (d) => str(get(d, R, "relationship")) === "sibling",
  },
};
