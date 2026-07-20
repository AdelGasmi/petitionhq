import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } from "pdf-lib";
import { readFile } from "fs/promises";
import { join } from "path";

export type FieldValue = string | boolean | null | undefined;

export interface PdfFieldMap {
  formId: string;
  /** PDF template filename (in assets/pdf-templates/) */
  templateFile: string;
  /** Map from PDF field name → value resolver */
  fields: Record<string, (data: Record<string, unknown>) => FieldValue>;
}

function get(obj: Record<string, unknown>, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

export function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Split "Given Family" or "Family, Given" into [family, given] for USCIS fields */
export function splitName(fullName: unknown): { family: string; given: string; middle: string } {
  const s = str(fullName);
  if (!s) return { family: "", given: "", middle: "" };
  // "Last, First Middle" format
  if (s.includes(",")) {
    const [last, rest] = s.split(",").map((p) => p.trim());
    const parts = rest.split(/\s+/);
    return { family: last, given: parts[0] ?? "", middle: parts.slice(1).join(" ") };
  }
  // "First [Middle] Last" format — last token is family name
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { family: parts[0], given: "", middle: "" };
  if (parts.length === 2) return { family: parts[1], given: parts[0], middle: "" };
  return { family: parts[parts.length - 1], given: parts[0], middle: parts.slice(1, -1).join(" ") };
}

/** Strip A-Number prefix — USCIS PDFs pre-print "A-" and expect 9 digits only */
export function alienNum(v: unknown): string {
  return str(v).replace(/^A-?/i, "").replace(/\D/g, "");
}

/** Strip SSN dashes/spaces — many PDF fields have maxLength=9 */
export function ssnDigits(v: unknown): string {
  return str(v).replace(/\D/g, "");
}

/** Format a date string to MM/DD/YYYY if it's in ISO format */
export function fmtDate(v: unknown): string {
  const s = str(v);
  if (!s) return "";
  // already MM/DD/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // ISO: YYYY-MM-DD
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}`;
  return s;
}

/** Fill a decrypted PDF template with data. Returns the PDF bytes. */
export async function fillPdf(map: PdfFieldMap, formData: Record<string, unknown>): Promise<Uint8Array> {
  const templatePath = join(process.cwd(), "assets", "pdf-templates", map.templateFile);
  const bytes = await readFile(templatePath);
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();

  let skipped = 0;
  for (const [fieldName, resolver] of Object.entries(map.fields)) {
    const value = resolver(formData);
    if (value == null || value === "") continue;

    try {
      const field = form.getField(fieldName);
      if (field instanceof PDFTextField) {
        field.setText(String(value));
      } else if (field instanceof PDFCheckBox) {
        if (value === true) field.check();
        else field.uncheck();
      } else if (field instanceof PDFDropdown) {
        const opt = String(value);
        const opts = field.getOptions();
        if (opts.includes(opt)) field.select(opt);
      }
    } catch {
      skipped++;
    }
  }

  return doc.save();
}

export { get };
