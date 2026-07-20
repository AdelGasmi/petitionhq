/**
 * Shared types for the verification layer.
 *
 * Every verification source returns typed results with confidence scores
 * and source URLs. No PII is stored here — only publicly verifiable facts.
 */

// ─── Polite pool identification ─────────────────────────────────────
// All free/keyless APIs (OpenAlex, Crossref, arXiv, DBLP, etc.) operate
// "polite pools" keyed on User-Agent. Identifying ourselves ensures rate
// limit issues result in an email warning, not an IP ban.

export const POLITE_USER_AGENT = "PetitionHQ-Verification-Engine/1.0 (mailto:adel@petitionhq.us)";
export const POLITE_MAILTO = "adel@petitionhq.us";

// ─── Verification sources ───────────────────────────────────────────

export type VerificationSource =
  | "openalex"
  | "orcid"
  | "ror"
  | "crossref"
  | "nsf"
  | "nih"
  | "uspto"
  | "semantic_scholar"
  | "arxiv"
  | "dblp"
  | "pubmed"
  | "linkedin";

export type ClaimStatus = "verified" | "self_reported" | "contradicted" | "ambiguous" | "inconclusive" | "not_found";

// ─── OpenAlex ───────────────────────────────────────────────────────

export type OpenAlexAuthor = {
  id: string;               // OpenAlex author ID (e.g., "A5023888391")
  displayName: string;
  institution?: string;
  worksCount: number;
  citedByCount: number;
  hIndex: number;
  sourceUrl: string;         // https://openalex.org/<id>
  confidence: number;        // 0.0 to 1.0
  matchSignals: string[];    // ["institution_match", "field_match", "name_exact"]
  matchQuality?: "deterministic" | "fuzzy" | "ambiguous";
  // deterministic = ORCID→OpenAlex direct lookup (confidence 1.0)
  // fuzzy         = name-based search with scoring (default)
  // ambiguous     = multiple plausible candidates or claimed-count mismatch
  affiliationRorIds: string[];  // ROR IDs from all known affiliations — used to cross-check claimed institution
  topField?: string;            // OpenAlex top-topic field name (e.g. "Medicine", "Computer Science") — authoritative field signal for identity reconciliation
};

export type OpenAlexWork = {
  id: string;
  title: string;
  doi?: string;
  publicationYear: number;
  citedByCount: number;
  sourceUrl: string;
};

// ─── ORCID ──────────────────────────────────────────────────────────

export type OrcidProfile = {
  orcidId: string;           // "0000-0002-1825-0097"
  displayName: string;
  currentAffiliation?: string;
  publicationCount: number;
  sourceUrl: string;         // https://orcid.org/<id>
  confidence: number;
  /** True when fetched directly by ORCID iD with a name guard (not name-searched). */
  fetchedById?: boolean;
  /** DOIs from ORCID works record, available only when fetchedById=true. */
  dois?: string[];
};

// ─── ROR ────────────────────────────────────────────────────────────

export type RorOrg = {
  id: string;                // ROR ID
  name: string;              // canonical name
  acronyms: string[];
  country: string;
  types: string[];           // education | facility | company | ...
  sourceUrl: string;
  confidence: number;
};

// ─── Grants ─────────────────────────────────────────────────────────

export type Grant = {
  id: string;
  title: string;
  piName: string;
  agency: "nsf" | "nih";
  startDate?: string;
  endDate?: string;
  amount?: number;
  sourceUrl: string;
  confidence: number;
};

// ─── Patents ────────────────────────────────────────────────────────

export type Patent = {
  id: string;                // patent number
  title: string;
  inventorName: string;
  grantDate: string;
  sourceUrl: string;
  confidence: number;
};

// ─── Crossref ───────────────────────────────────────────────────────

export type CrossrefWork = {
  doi: string;
  title: string;
  authors: string[];
  publicationYear: number;
  journal?: string;
  citedByCount: number;
  sourceUrl: string;
};

// ─── Semantic Scholar ──────────────────────────────────────────────

export type SemanticScholarAuthor = {
  id: string;               // Semantic Scholar author ID
  displayName: string;
  paperCount: number;
  citationCount: number;
  hIndex: number;
  influentialCitationCount: number;
  sourceUrl: string;         // https://www.semanticscholar.org/author/<id>
  confidence: number;
};

// ─── arXiv ─────────────────────────────────────────────────────────

export type ArxivResult = {
  authorName: string;
  paperCount: number;
  papers: Array<{
    id: string;               // arXiv ID e.g. "2301.07041"
    title: string;
    published: string;        // ISO date
    categories: string[];     // e.g. ["cs.LG", "cs.AI"]
  }>;
  sourceUrl: string;           // arXiv search URL
  confidence: number;
};

// ─── DBLP ──────────────────────────────────────────────────────────

export type DblpResult = {
  authorName: string;
  authorUrl: string;           // DBLP author page
  publicationCount: number;
  venueBreakdown: {
    conferences: number;
    journals: number;
    other: number;
  };
  topVenues: string[];         // e.g. ["NeurIPS", "CVPR", "AAAI"]
  sourceUrl: string;
  confidence: number;
};

// ─── PubMed ────────────────────────────────────────────────────────

export type PubmedResult = {
  authorName: string;
  paperCount: number;          // count of PubMed-indexed articles by this author
  recentCount: number;         // articles in the last 5 years
  topJournals: string[];       // distinct journals (best effort)
  sourceUrl: string;           // PubMed search URL
  confidence: number;
};

// ─── Claim result (stored in Lead.verifiedClaims) ───────────────────

export type ClaimResult = {
  status: ClaimStatus;
  source: VerificationSource;
  sourceUrl?: string;
  confidence: number;
  detail?: string;          // e.g., "12 publications found" or "claimed 200, found 5"
  verifiedAt: string;       // ISO 8601
};
