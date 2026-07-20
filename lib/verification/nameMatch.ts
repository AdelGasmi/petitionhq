/**
 * Shared name-matching utilities for the verification layer.
 *
 * International researchers break naive name matching: diacritics (José,
 * Müller), transliteration, and name-order variation ("Li Fei-Fei" vs
 * "Fei-Fei Li", "Last, First"). These helpers fold names to a comparable
 * form and compare them order-tolerantly so a real, findable researcher is
 * not rejected just because their name is spelled or ordered differently
 * than the database record.
 */

/**
 * Fold a name to a normalized, diacritic-free, lowercase token form.
 * "José Müller-Schön" → "jose muller schon"
 */
export function foldName(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+\d{4}$/, "") // strip DBLP-style "Wei Wang 0042" disambiguators
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return foldName(s).split(" ").filter(Boolean);
}

/**
 * Order-tolerant name match. Returns a strength in [0, 1]:
 *   1.0  — every query token is present (exact set match, any order)
 *   0.8  — last names match and first names share an initial (handles
 *          "J. Smith" vs "John Smith", "Fei-Fei Li" vs "Li Fei-Fei")
 *   0.0  — no plausible match
 *
 * Designed to be permissive on order/initials (the common international
 * failure mode) while still requiring the surname to line up.
 */
export function nameMatchStrength(apiName: string, queryName: string): number {
  const a = foldName(apiName);
  const q = foldName(queryName);
  if (!a || !q) return 0;
  if (a === q) return 1;

  const aTok = tokens(apiName);
  const qTok = tokens(queryName);
  if (aTok.length === 0 || qTok.length === 0) return 0;

  // Exact set match (order-independent): every query token appears in api name
  const aSet = new Set(aTok);
  const everyQueryTokenPresent = qTok.every((t) => aSet.has(t));
  const everyApiTokenPresent = aTok.every((t) => new Set(qTok).has(t));
  if (everyQueryTokenPresent && everyApiTokenPresent) return 1;
  if (everyQueryTokenPresent || everyApiTokenPresent) return 0.95;

  // Surname + first-initial match, order-tolerant.
  // Try treating either the first or last token as the surname, since
  // name order differs across cultures and database conventions.
  const candidatesSurname = [aTok[aTok.length - 1], aTok[0]];
  const qSurnameCandidates = [qTok[qTok.length - 1], qTok[0]];
  const qFirstCandidates = [qTok[0], qTok[qTok.length - 1]];
  const aFirstCandidates = [aTok[0], aTok[aTok.length - 1]];

  for (const aSur of candidatesSurname) {
    for (const qSur of qSurnameCandidates) {
      if (aSur === qSur && aSur.length > 1) {
        // Surname aligns — check a first-name/initial agreement
        const initialMatch = aFirstCandidates.some((af) =>
          qFirstCandidates.some((qf) => af && qf && af[0] === qf[0]),
        );
        if (initialMatch) return 0.8;
      }
    }
  }

  return 0;
}

export function isNameMatch(apiName: string, queryName: string): boolean {
  return nameMatchStrength(apiName, queryName) >= 0.8;
}
