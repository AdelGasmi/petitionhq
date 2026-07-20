/**
 * Field detection + per-field source routing.
 *
 * Different research fields live in different databases. Treating every
 * source as equally relevant for every applicant is the bug that made a
 * computer scientist (indexed in DBLP/arXiv, thin in OpenAlex) score the
 * same as a no-show. We detect the field from intake + API metadata and
 * know which sources are *expected* to corroborate, so the absence of an
 * irrelevant source (e.g. no PubMed hit for a CS researcher) never counts
 * against the applicant.
 *
 * Field → source coverage is from the documented scope of each database
 * (DBLP = CS only, PubMed = biomed, INSPIRE-HEP = physics, etc.).
 */

import type { VerificationSource } from "./types";

export type ResearchField =
  | "cs"
  | "biomed"
  | "physics"
  | "chemistry"
  | "engineering"
  | "math"
  | "social"
  | "environmental"
  | "other";

export const FIELD_LABELS: Record<ResearchField, string> = {
  cs: "Computer Science",
  biomed: "Biomedical / Life Sciences",
  physics: "Physics / Astronomy",
  chemistry: "Chemistry / Materials Science",
  engineering: "Engineering",
  math: "Mathematics",
  social: "Social Sciences / Economics",
  environmental: "Environmental / Earth Sciences",
  other: "Research",
};

/**
 * Sources that are expected to have meaningful coverage for a field.
 * "openalex", "orcid", "crossref", "semantic_scholar" are broad and apply
 * everywhere; the rest are field-specific.
 */
export const FIELD_PRIMARY_SOURCES: Record<ResearchField, VerificationSource[]> = {
  cs:            ["dblp", "semantic_scholar", "arxiv", "openalex"],
  biomed:        ["pubmed", "semantic_scholar", "openalex", "nih"],
  physics:       ["arxiv", "openalex", "semantic_scholar"],
  chemistry:     ["crossref", "openalex", "semantic_scholar"],
  engineering:   ["crossref", "openalex", "semantic_scholar"],
  math:          ["arxiv", "openalex", "crossref"],
  social:        ["openalex", "crossref", "semantic_scholar"],
  environmental: ["openalex", "crossref", "semantic_scholar"],
  other:         ["openalex", "semantic_scholar", "crossref", "orcid"],
};

// Keyword markers for the second-pass field detection. Longest/most-specific
// matches should be listed; detection scans these against the lowercased input.
const FIELD_KEYWORDS: Array<{ field: ResearchField; terms: string[] }> = [
  { field: "cs", terms: ["computer science", "machine learning", "artificial intelligence", " ai ", "deep learning", "neural network", "nlp", "natural language", "computer vision", "robotics", "cybersecurity", "data science", "software", "algorithm", "distributed system", "hci", "human-computer"] },
  { field: "biomed", terms: ["biomed", "biology", "biolog", "medicine", "medical", "clinical", "genom", "genetic", "oncology", "cancer", "neuroscience", "immunolog", "pharma", "drug discovery", "biotech", "bioinformatic", "molecular", "cell ", "public health", "epidemiolog", "health"] },
  { field: "physics", terms: ["physics", "astronom", "astrophysic", "cosmolog", "particle", "quantum", "high-energy", "high energy", "optics", "photonics", "condensed matter"] },
  { field: "chemistry", terms: ["chemistry", "chemical", "materials science", "material science", "polymer", "catalysis", "nanomaterial", "electrochem"] },
  { field: "engineering", terms: ["engineering", "mechanical", "electrical", "civil engineer", "aerospace", "structural", "manufacturing", "control system"] },
  { field: "math", terms: ["mathematics", "mathematical", "topology", "algebra", "geometry", "number theory", "statistics", "probability", "optimization"] },
  { field: "social", terms: ["economics", "economic", "social science", "sociolog", "psycholog", "political science", "finance", "management", "business"] },
  { field: "environmental", terms: ["environmental", "climate", "earth science", "geoscience", "ecology", "ecolog", "atmospheric", "oceanograph", "sustainab"] },
];

// OpenAlex `field.display_name` → our bucket.
const OPENALEX_FIELD_MAP: Record<string, ResearchField> = {
  "computer science": "cs",
  "medicine": "biomed",
  "biochemistry, genetics and molecular biology": "biomed",
  "immunology and microbiology": "biomed",
  "neuroscience": "biomed",
  "pharmacology, toxicology and pharmaceutics": "biomed",
  "nursing": "biomed",
  "health professions": "biomed",
  "physics and astronomy": "physics",
  "chemistry": "chemistry",
  "materials science": "chemistry",
  "chemical engineering": "chemistry",
  "engineering": "engineering",
  "mathematics": "math",
  "economics, econometrics and finance": "social",
  "social sciences": "social",
  "psychology": "social",
  "business, management and accounting": "social",
  "decision sciences": "social",
  "earth and planetary sciences": "environmental",
  "environmental science": "environmental",
  "agricultural and biological sciences": "environmental",
};

/**
 * Detect research field from the applicant's self-reported field string,
 * optionally refined by the OpenAlex top-topic field name (more reliable
 * when available). Returns "other" when nothing matches.
 */
export function detectField(input: {
  selfReported?: string;
  openalexTopField?: string;
}): ResearchField {
  // OpenAlex topic field is authoritative when present.
  if (input.openalexTopField) {
    const mapped = OPENALEX_FIELD_MAP[input.openalexTopField.toLowerCase().trim()];
    if (mapped) return mapped;
  }

  const raw = (input.selfReported ?? "").toLowerCase();
  if (raw) {
    const padded = ` ${raw} `;
    for (const { field, terms } of FIELD_KEYWORDS) {
      if (terms.some((t) => padded.includes(t))) return field;
    }
  }

  return "other";
}
