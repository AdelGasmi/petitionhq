/** Shared filename helpers — used across download routes and R2 key construction. */

/** Format a Date (or "now") as DDMMYY, e.g. 170526 for 17 May 2026. */
export function ddmmyy(date: Date = new Date()): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${d}${m}${y}`;
}

/** Sanitize a human name into a filename-safe slug with Title-Case hyphens.
 *  "Jane M. Doe"  → "Jane-Doe"
 *  "prof. zhang"  → "Zhang"  (initials/prefixes stripped)
 *  Falls back to the provided default if the result is empty. */
export function nameSlug(raw: string | null | undefined, fallback = "Unknown"): string {
  if (!raw?.trim()) return fallback;
  return raw
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1 && !/^[A-Z]\.$/.test(w)) // drop single initials like "M."
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, "").replace(/^(.)/, (c) => c.toUpperCase()))
    .filter(Boolean)
    .join("-") || fallback;
}

/** Compact a tier string to a short label: "tier1" → "T1", "tier2" → "T2", etc. */
export function tierLabel(tier: string | null | undefined): string {
  if (!tier) return "T3";
  const m = tier.match(/(\d)$/);
  return m ? `T${m[1]}` : tier.toUpperCase().slice(0, 2);
}

/** Build the full name from petitionerInfo (familyName + givenName). */
export function petitionerSlug(
  petitionerInfo: Record<string, unknown> | null | undefined,
  fallback = "Applicant"
): string {
  if (!petitionerInfo) return fallback;
  const given = String(petitionerInfo.givenName ?? "").trim();
  const family = String(petitionerInfo.familyName ?? "").trim();
  const full = [given, family].filter(Boolean).join(" ");
  return nameSlug(full, fallback);
}

// ---------------------------------------------------------------------------
// Named filename builders
// ---------------------------------------------------------------------------

/** R2 storage key for a dossier PDF. Uses a human-readable folder + opaque id leaf. */
export function dossierStorageKey(leadId: string, name: string | null | undefined, tier: string | null | undefined, date: Date = new Date()): string {
  return `dossiers/${ddmmyy(date)}_${nameSlug(name)}_${tierLabel(tier)}/${leadId}.pdf`;
}

/** Content-Disposition filename for a dossier download. */
export function dossierFilename(name: string | null | undefined, tier: string | null | undefined, date: Date = new Date()): string {
  return `Dossier_${nameSlug(name)}_${tierLabel(tier)}_${ddmmyy(date)}.pdf`;
}

/** Content-Disposition filename for a pre-filled USCIS form PDF. */
export function formPdfFilename(formNumber: string, petitionerInfo: Record<string, unknown> | null | undefined, date: Date = new Date()): string {
  const form = formNumber.toUpperCase().replace(/[^A-Z0-9-]/g, "-");
  return `${form}_${petitionerSlug(petitionerInfo)}_${ddmmyy(date)}.pdf`;
}

/** Content-Disposition filename for a petition letter (PDF or DOCX). */
export function petitionLetterFilename(petitionerInfo: Record<string, unknown> | null | undefined, ext: "pdf" | "docx", date: Date = new Date()): string {
  return `PetitionLetter_${petitionerSlug(petitionerInfo)}_${ddmmyy(date)}.${ext}`;
}

/** Content-Disposition filename for a recommendation letter (PDF or DOCX). */
export function recLetterFilename(recommenderName: string | null | undefined, petitionerInfo: Record<string, unknown> | null | undefined, ext: "pdf" | "docx", date: Date = new Date()): string {
  return `RecLetter_${nameSlug(recommenderName, "Recommender")}_${petitionerSlug(petitionerInfo)}_${ddmmyy(date)}.${ext}`;
}

/** Content-Disposition filename for the admin leads CSV export. */
export function leadsCsvFilename(date: Date = new Date()): string {
  return `Leads_${ddmmyy(date)}.csv`;
}
