import { type PdfFieldMap, fmtDate, str, get, alienNum, ssnDigits } from "../engine";

// Section "applicant" → camelCase → "applicant"
// Section "application-type" → camelCase → "applicationType"
const S = "applicant";
const AT = "applicationType";

function addr(data: Record<string, unknown>) {
  return (get(data, S, "currentAddress") ?? {}) as Record<string, string>;
}

export const i485Map: PdfFieldMap = {
  formId: "i485",
  templateFile: "i-485.pdf",
  fields: {
    // ── Part 1: About You ──────────────────────────────────────────────────
    // Current legal name
    "form1[0].#subform[0].Pt1Line1_FamilyName[0]": (d) => str(get(d, S, "familyName")),
    "form1[0].#subform[0].Pt1Line1_GivenName[0]":  (d) => str(get(d, S, "givenName")),
    "form1[0].#subform[0].Pt1Line1_MiddleName[0]": (d) => str(get(d, S, "middleName")),

    // Other names used
    "form1[0].#subform[0].Pt1Line2_FamilyName[0]": (d) => str(get(d, S, "otherFamilyName")),
    "form1[0].#subform[0].Pt1Line2_GivenName[0]":  (d) => str(get(d, S, "otherGivenName")),
    "form1[0].#subform[0].Pt1Line2_MiddleName[0]": (d) => str(get(d, S, "otherMiddleName")),

    // A-Number + USCIS account
    "form1[0].#subform[0].AlienNumber[0]": (d) => alienNum(get(d, S, "alienNumber")),
    "form1[0].#subform[0].USCISOnlineAcctNumber[0]": (d) => str(get(d, S, "uscisOnlineAccount")),

    // DOB
    "form1[0].#subform[0].Pt1Line3_DOB[0]": (d) => fmtDate(get(d, S, "dob")),

    // Sex (Male = [0], Female = [1])
    "form1[0].#subform[1].Pt1Line6_CB_Sex[0]": (d) => str(get(d, S, "sex")) === "male",
    "form1[0].#subform[1].Pt1Line6_CB_Sex[1]": (d) => str(get(d, S, "sex")) === "female",

    // Birth city + country
    "form1[0].#subform[1].Pt1Line7_CityTownOfBirth[0]":             (d) => str(get(d, S, "cityOfBirth")),
    "form1[0].#subform[1].Pt1Line7_CountryOfBirth[0]":              (d) => str(get(d, S, "countryOfBirth")),
    "form1[0].#subform[1].Pt1Line8_CountryofCitizenshipNationality[0]": (d) => str(get(d, S, "countryOfCitizenship")),

    // USCIS account (repeated on page 2)
    "form1[0].#subform[1].Pt1Line9_USCISAccountNumber[0]": (d) => str(get(d, S, "uscisOnlineAccount")),

    // Passport
    "form1[0].#subform[1].Pt1Line10_PassportNum[0]": (d) => str(get(d, S, "passportNumber")),
    "form1[0].#subform[1].Pt1Line10_Passport[0]":    (d) => str(get(d, S, "passportCountry")),
    "form1[0].#subform[1].Pt1Line10_ExpDate[0]":     (d) => fmtDate(get(d, S, "passportExpiry")),

    // Visa number + last entry
    "form1[0].#subform[1].Pt1Line10_VisaNum[0]":         (d) => str(get(d, S, "visaNumber")),
    "form1[0].#subform[1].Pt1Line10_DateofArrival[0]":   (d) => fmtDate(get(d, S, "lastEntryDate")),
    "form1[0].#subform[1].Pt1Line10_NonImmDate[0]":      (d) => fmtDate(get(d, S, "statusExpiry")),

    // Current address
    "form1[0].#subform[2].Pt1Line18_StreetNumberName[0]": (d) => addr(d).street,
    "form1[0].#subform[2].Pt1Line18_CityOrTown[0]":       (d) => addr(d).city,
    "form1[0].#subform[2].Pt1Line18_State[0]":            (d) => addr(d).state,
    "form1[0].#subform[2].Pt1Line18_ZipCode[0]":          (d) => addr(d).zip,

    // I-94 + current status
    "form1[0].#subform[2].P1Line12_I94[0]":      (d) => str(get(d, S, "i94Number")),
    "form1[0].#subform[2].Pt1Line12_Status[0]":  (d) => str(get(d, S, "currentStatus")),

    // SSN
    "form1[0].#subform[3].Pt1Line19_SSN[0]": (d) => ssnDigits(get(d, S, "ssn")),

    // ── Part 2: Application Type ────────────────────────────────────────────
    "form1[0].#subform[1].Pt2Line11_CB[0]": (d) =>
      str(get(d, AT, "category")) === "family-immediate",
    "form1[0].#subform[1].Pt2Line11_CB[1]": (d) =>
      str(get(d, AT, "category")) === "family-preference",
    "form1[0].#subform[1].Pt2Line11_CB[2]": (d) =>
      str(get(d, AT, "category")) === "employment",
    "form1[0].#subform[1].Pt2Line11_CB[3]": (d) =>
      str(get(d, AT, "category")) === "asylum",

    // Underlying receipt number
    "form1[0].#subform[1].Pt1Line11_Admitted[0]": (d) =>
      str(get(d, AT, "underlyingReceiptNumber")),
  },
};
