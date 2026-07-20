/**
 * Validation for the public /check intake.
 *
 * Deliberately tiny and shared between the client wizard and the server routes
 * so garbage can't enter via either path. Currently guards the one free-text
 * field — "field of expertise" — which historically collected junk like "18",
 * "2", or "cpu". Plausibility validation was added to reject these.
 */

/**
 * A plausible research field must contain at least two letters. This rejects
 * pure numbers ("18", "2"), single characters, and symbol-only input, while
 * accepting short real fields ("AI", "ML", "CS") and non-Latin scripts
 * (\p{L} matches any Unicode letter).
 */
export function isPlausibleResearchField(value: string | null | undefined): boolean {
  if (!value) return false;
  const letters = value.match(/\p{L}/gu);
  return (letters?.length ?? 0) >= 2;
}
