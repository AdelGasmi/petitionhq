import { type PdfFieldMap, fmtDate, str, get } from "../engine";

// Section "applicant" → camelCase → "applicant"
// Section "document-type" → camelCase → "documentType"
// Section "travel-plans" → camelCase → "travelPlans"
const S = "applicant";
const DT = "documentType";

function addr(data: Record<string, unknown>) {
  return (get(data, S, "currentAddress") ?? {}) as Record<string, string>;
}

export const i131Map: PdfFieldMap = {
  formId: "i131",
  templateFile: "i-131.pdf",
  fields: {
    // ── Part 1: Application Type ────────────────────────────────────────────
    "form1[0].P1[0].CB_AppType[0]": (d) => str(get(d, DT, "documentType")) === "advance-parole",
    "form1[0].P1[0].CB_AppType[1]": (d) => str(get(d, DT, "documentType")) === "reentry-permit",
    "form1[0].P1[0].CB_AppType[2]": (d) => str(get(d, DT, "documentType")) === "refugee-travel",
    "form1[0].P1[0].CB_AppType[3]": (d) => str(get(d, DT, "documentType")) === "combo-card",

    // ── Part 2: Applicant Name ──────────────────────────────────────────────
    "form1[0].P4[0].Part2_Line1_FamilyName[0]": (d) => str(get(d, S, "familyName")),
    "form1[0].P4[0].Part2_Line1_GivenName[0]":  (d) => str(get(d, S, "givenName")),
    "form1[0].P4[0].Part2_Line1_MiddleName[0]": (d) => str(get(d, S, "middleName")),

    // Address
    "form1[0].P5[0].Part2_Line3_StreetNumberName[0]": (d) => addr(d).street,
    "form1[0].P5[0].Part2_Line3_CityTown[0]":         (d) => addr(d).city,
    "form1[0].P5[0].Part2_Line3_State[0]":            (d) => addr(d).state,
    "form1[0].P5[0].Part2_Line3_ZipCode[0]":          (d) => addr(d).zip,

    // DOB + birth country
    "form1[0].P4[0].P1_Line12_DateOfAdmission[0]": (d) => fmtDate(get(d, S, "lastEntryDate")),

    // I-485 receipt number (for Advance Parole basis)
    "form1[0].P2[0].P1_Line5B[0]": (d) => str(get(d, DT, "i485ReceiptNumber")),
    "form1[0].P2[0].P1_Line5C[0]": (d) => fmtDate(get(d, DT, "i485FiledDate")),
  },
};
