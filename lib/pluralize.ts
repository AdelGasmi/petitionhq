/**
 * Tiny count formatter — fixes the recurring "1 admins" / "1 leads claimed"
 * singular/plural nits surfaced in the admin/attorney UI review.
 *
 *   plural(1, "admin")           → "1 admin"
 *   plural(2, "admin")           → "2 admins"
 *   plural(1, "lead", "leads")   → "1 lead"   (explicit plural for irregulars)
 */
export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = count === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${count} ${word}`;
}
