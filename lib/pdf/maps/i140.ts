import { type PdfFieldMap, fmtDate, str, get, alienNum, ssnDigits } from "../engine";

// Section key: "petitioner-info" → camelCase → "petitionerInfo"
const S = "petitionerInfo";

function addr(data: Record<string, unknown>) {
  return (get(data, S, "currentAddress") ?? {}) as Record<string, string>;
}

export const i140Map: PdfFieldMap = {
  formId: "i140-niw",
  templateFile: "i-140.pdf",
  fields: {
    // ── Part 1: Petitioner (self = beneficiary for NIW) ────────────────────
    "form1[0].#subform[0].Pt1Line1a_FamilyName[0]": (d) => str(get(d, S, "familyName")),
    "form1[0].#subform[0].Pt1Line1b_GivenName[0]":  (d) => str(get(d, S, "givenName")),
    "form1[0].#subform[0].Pt1Line1c_MiddleName[0]": (d) => str(get(d, S, "middleName")),

    // Petitioner address
    "form1[0].#subform[0].Line6b_StreetNumberName[0]": (d) => addr(d).street,
    "form1[0].#subform[0].Line6d_CityOrTown[0]":       (d) => addr(d).city,
    "form1[0].#subform[0].Line6e_State[0]":            (d) => addr(d).state,
    "form1[0].#subform[0].Line6f_ZipCode[0]":          (d) => addr(d).zip,

    // SSN + USCIS account (maxLength=9, digits only)
    "form1[0].#subform[0].Line7_SSN[0]": (d) => ssnDigits(get(d, S, "ssn")),
    "form1[0].#subform[0].#area[1].Pt1Line8_USCISOnlineActNumber[0]": (d) =>
      str(get(d, S, "uscisOnlineAccount")),

    // Petition type: NIW = checkbox index 7 on subform[1]
    "form1[0].#subform[1].prt2PetitionType[7]": () => true,

    // ── Part 3: Beneficiary (same person for NIW self-petition) ────────────
    "form1[0].#subform[1].Pt3Line1a_FamilyName[0]": (d) => str(get(d, S, "familyName")),
    "form1[0].#subform[1].Pt3Line1b_GivenName[0]":  (d) => str(get(d, S, "givenName")),
    "form1[0].#subform[1].Pt3Line1c_MiddleName[0]": (d) => str(get(d, S, "middleName")),

    // Other names used
    "form1[0].#subform[2].Line3a_FamilyName2[0]": (d) => str(get(d, S, "otherFamilyName")),
    "form1[0].#subform[2].Line3b_GivenName2[0]":  (d) => str(get(d, S, "otherGivenName")),

    // Beneficiary address (same as petitioner for NIW)
    "form1[0].#subform[1].Line2b_StreetNumberName[0]": (d) => addr(d).street,
    "form1[0].#subform[1].Line2d_CityOrTown[0]":       (d) => addr(d).city,
    "form1[0].#subform[1].Line2e_State[0]":            (d) => addr(d).state,
    "form1[0].#subform[1].Line2f_ZipCode[0]":          (d) => addr(d).zip,

    // DOB, birth city/country, citizenship
    "form1[0].#subform[1].Line5_DateOfBirth[0]": (d) => fmtDate(get(d, S, "dob")),
    "form1[0].#subform[1].Line6_CityTownOfBirth[0]": (d) => str(get(d, S, "cityOfBirth")),
    "form1[0].#subform[1].Line7_StateProvinceOfBirth[0]": (d) => str(get(d, S, "stateOfBirth")),
    "form1[0].#subform[1].Line8_Country[0]":  (d) => str(get(d, S, "countryOfBirth")),
    "form1[0].#subform[1].Line9_Country[0]":  (d) => str(get(d, S, "countryOfCitizenship")),

    // A-Number (PDF pre-prints "A-", field takes 9 digits only) + SSN
    "form1[0].#subform[1].Line11_Alien[0].Pt3Line8_AlienNumber[0]": (d) =>
      alienNum(get(d, S, "alienNumber")),
    "form1[0].#subform[1].Line12_SSN[0]": (d) => ssnDigits(get(d, S, "ssn")),

    // Passport
    "form1[0].#subform[1].Line14b_Passport[0]":         (d) => str(get(d, S, "passportNumber")),
    "form1[0].#subform[1].Line14d_CountryOfIssuance[0]":(d) => str(get(d, S, "passportCountry")),
    "form1[0].#subform[1].Line14e_ExpDate[0]":          (d) => fmtDate(get(d, S, "passportExpiry")),

    // Date of last entry + current status
    "form1[0].#subform[1].Line13_DateOArrival[0]": (d) => fmtDate(get(d, S, "lastEntryDate")),
    "form1[0].#subform[1].Line15_CurrentNon[0]":   (d) => str(get(d, S, "currentStatus")),

    // I-94
    "form1[0].#subform[1].Line14_I94Number[0].Line14a_ArrivalDeparture[0]": (d) =>
      str(get(d, S, "i94Number")),

    // Part 5: self-employed (NIW self-petition)
    "form1[0].#subform[2].Line1b_Self[0]": () => true,
  },
};
