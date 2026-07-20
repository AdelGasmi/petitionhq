/**
 * Identity reconciliation — the layer that turns "N databases each returned
 * SOMEONE with this name" into "N sources agree this is the SAME person."
 *
 * ── Why this exists ──────────────────────────────────────────────────
 * Every source adapter name-searches independently and returns its own
 * "is this a plausible real person named X" confidence. For a common name,
 * each database finds a *different* real person and reports high confidence.
 * Counting that as corroboration is how an internal-medicine MD got credited
 * with another person's microelectronics papers + NSF grants and scored 92.
 *
 * This module resolves a single identity ANCHOR (the record we're most sure
 * is the applicant) and classifies every other source by whether it AGREES
 * with that anchor. The trust scorer then only credits agreeing sources.
 *
 * ── Design rule: drop, don't punish ─────────────────────────────────
 * A source that doesn't fit the resolved identity is *dropped* from
 * corroboration (treated as a probable namesake) — it never subtracts
 * points. We only ever decline to *credit* uncorroborated breadth. The one
 * place we subtract is a material self-report overclaim, and only when the
 * identity is confidently resolved (see scoring.ts). This keeps a real,
 * messy-but-honest researcher from being penalized for someone else's
 * namesake records.
 */

import type {
  OpenAlexAuthor,
  OrcidProfile,
  SemanticScholarAuthor,
  ArxivResult,
  DblpResult,
  PubmedResult,
  CrossrefWork,
  Grant,
  Patent,
  VerificationSource,
} from "./types";
import { detectField, type ResearchField } from "./fields";

// ─── Public types ───────────────────────────────────────────────────

export type AnchorConfidence = "high" | "medium" | "low" | "none";

export type AnchorBasis =
  | "orcid_oauth"           // applicant proved ORCID account ownership via OAuth (highest)
  | "orcid_deterministic"   // applicant ORCID → OpenAlex direct lookup (gold)
  | "orcid_provided"        // applicant-provided ORCID iD fetched directly, name-guarded (anchor=medium)
  | "openalex_corroborated" // OpenAlex match + institution/field signal or ≥2 agreeing sources
  | "openalex_name"         // OpenAlex name-only match, thinly corroborated
  | "openalex_ambiguous"    // OpenAlex itself flagged the match uncertain
  | "orcid_only"            // ORCID name-search, no OpenAlex
  | "sources_only"          // no OpenAlex/ORCID, but other sources returned hits
  | "none";                 // nothing returned

export type SourceVerdict =
  | "agree"            // consistent with the resolved identity — credit it
  | "field_mismatch"   // field-specialized DB whose field doesn't fit — likely namesake
  | "magnitude_mismatch" // output dwarfs a deterministic anchor — different person
  | "unconfirmed";     // found a hit but the anchor is too weak to trust it

export type IdentityResolution = {
  anchor: AnchorConfidence;
  basis: AnchorBasis;
  resolvedField: ResearchField;
  /** Per-source verdict for the sources that returned a hit. */
  verdicts: Partial<Record<VerificationSource, SourceVerdict>>;
  /** Sources whose verdict is "agree" — these corroborate the identity. */
  agreeingSources: VerificationSource[];
  /** True when we're confident enough about the true output to judge a self-reported overclaim. */
  claimCheckEnabled: boolean;
  reasons: string[];
};

export type IdentityInput = {
  openalex?: OpenAlexAuthor | null;
  orcid?: OrcidProfile | null;
  semanticScholar?: SemanticScholarAuthor | null;
  arxiv?: ArxivResult | null;
  dblp?: DblpResult | null;
  pubmed?: PubmedResult | null;
  crossrefWorks?: CrossrefWork[];
  nsfGrants?: Grant[];
  nihGrants?: Grant[];
  patents?: Patent[];
  /** Self-reported field string from intake. */
  declaredField?: string;
  /** True when the applicant has proven ORCID account ownership via OAuth. */
  orcidAuthenticated?: boolean;
  /** Self-reported publication count from intake — used by TRU-4 plausibility guard. */
  claimedPublicationCount?: number;
};

// ─── Field credibility ──────────────────────────────────────────────
// Field-specialized databases only corroborate identity for the fields
// they actually index. A hit outside that set is a probable namesake.
// (Broad sources — OpenAlex/ORCID/Semantic Scholar/Crossref/arXiv — are not
// field-gated here; arXiv's own field routing handles relevance, and the
// rest span every field.)
const FIELD_SPECIALIZED: Partial<Record<VerificationSource, ResearchField[]>> = {
  // DBLP indexes computer science + adjacent EE/circuits and theoretical CS.
  // A DBLP hit for a biomedical / chemistry / pure-physics / social-science
  // applicant is the classic namesake (ISCAS papers under a clinician's name).
  dblp: ["cs", "engineering", "math"],
  // PubMed is biomedical. (The orchestrator already only runs it for biomed,
  // so this is belt-and-suspenders.)
  pubmed: ["biomed"],
};

function fieldFits(source: VerificationSource, field: ResearchField): boolean {
  const credible = FIELD_SPECIALIZED[source];
  if (!credible) return true;        // not field-specialized → always plausible
  if (field === "other") return true; // field unknown → can't prove a mismatch
  return credible.includes(field);
}

// ─── Reconciliation ─────────────────────────────────────────────────

export function reconcileIdentity(input: IdentityInput): IdentityResolution {
  const reasons: string[] = [];
  const verdicts: Partial<Record<VerificationSource, SourceVerdict>> = {};

  const oa = input.openalex ?? null;
  const orcid = input.orcid ?? null;

  // 1. Resolve the field. OpenAlex's top-topic field is authoritative when
  //    present (objective), else fall back to the self-reported field.
  const resolvedField = detectField({
    selfReported: input.declaredField,
    openalexTopField: oa?.topField,
  });

  // 2. Determine the anchor basis from signals known up front.
  const deterministic = oa?.matchQuality === "deterministic";
  const ambiguous = oa?.matchQuality === "ambiguous";
  const oaUsable = !!oa && !ambiguous;
  // A caller-provided ORCID iD fetched directly (fetchedById=true) is a stronger
  // anchor than an ambiguous OpenAlex name match: the applicant proved they own
  // this iD by submitting it, and we name-guarded it against the self-report.
  const orcidById = orcid?.fetchedById === true;

  let basis: AnchorBasis;
  if (input.orcidAuthenticated) basis = "orcid_oauth"; // OAuth ownership proof — no impersonation possible
  else if (deterministic) basis = "orcid_deterministic";
  else if (oaUsable) basis = "openalex_name"; // upgraded to _corroborated below
  else if (orcidById) basis = "orcid_provided"; // beats ambiguous OA; anchor=medium in step 4
  else if (ambiguous) basis = "openalex_ambiguous";
  else if (orcid) basis = "orcid_only";
  else basis = "none"; // may become sources_only below

  // 3. Classify each non-anchor source that returned a hit.
  //    Field gate applies always. Magnitude gate applies ONLY under a
  //    deterministic anchor — when we have the canonical record, a name-search
  //    source whose output dwarfs it is genuinely a different (more prolific)
  //    person. Under a fuzzy anchor we do NOT magnitude-gate, because OpenAlex
  //    itself frequently undercounts (split author IDs) and we must not drop
  //    the fuller source — that is the exact false-negative the model avoids.
  const anchorWorks = oa?.worksCount ?? 0;
  const anchorCitations = oa?.citedByCount ?? 0;
  const magnitudeGate = deterministic && anchorWorks > 0;

  const classify = (
    source: VerificationSource,
    present: boolean,
    works?: number,
    citations?: number,
  ): void => {
    if (!present) return;
    if (!fieldFits(source, resolvedField)) {
      verdicts[source] = "field_mismatch";
      reasons.push(`${source}: field mismatch (does not index ${resolvedField}) — probable namesake, not counted`);
      return;
    }
    if (
      magnitudeGate &&
      ((works !== undefined && works > anchorWorks * 3 + 20) ||
        (citations !== undefined && anchorCitations > 0 && citations > anchorCitations * 3 + 100))
    ) {
      verdicts[source] = "magnitude_mismatch";
      reasons.push(`${source}: output far exceeds the ORCID-resolved record — different person, not counted`);
      return;
    }
    verdicts[source] = "agree";
  };

  // Pub/citation-bearing sources (field + magnitude checks).
  classify("semantic_scholar", !!input.semanticScholar, input.semanticScholar?.paperCount, input.semanticScholar?.citationCount);
  classify("dblp", !!input.dblp && (input.dblp.publicationCount ?? 0) > 0, input.dblp?.publicationCount);
  classify("arxiv", !!input.arxiv && (input.arxiv.paperCount ?? 0) > 0, input.arxiv?.paperCount);
  classify("pubmed", !!input.pubmed && (input.pubmed.paperCount ?? 0) > 0, input.pubmed?.paperCount);
  classify("crossref", (input.crossrefWorks?.length ?? 0) > 0, input.crossrefWorks?.length);
  // ORCID corroborates identity when it's a separate source from the anchor.
  if (orcid && basis !== "orcid_only") classify("orcid", true, orcid.publicationCount);

  // US-only, name-search-only sources (NSF/NIH/USPTO) carry no field or
  // magnitude signal we can check, so they only corroborate identity once
  // the anchor is independently confident. Otherwise they're unconfirmable
  // namesakes (e.g. NSF awards under a Pakistan-based clinician's name).
  // Verdict is finalized after anchorConfidence is known (below).

  const agreeingFromChecked = (Object.entries(verdicts) as [VerificationSource, SourceVerdict][])
    .filter(([, v]) => v === "agree")
    .map(([s]) => s);

  // Per-source work counts — used by the TRU-7 cross-source rescue to compare
  // each corroborating source's SCALE against the applicant's own self-report.
  const sourceWorkCount: Partial<Record<VerificationSource, number>> = {
    semantic_scholar: input.semanticScholar?.paperCount,
    dblp: input.dblp?.publicationCount,
    arxiv: input.arxiv?.paperCount,
    pubmed: input.pubmed?.paperCount,
    crossref: input.crossrefWorks?.length,
    orcid: orcid?.publicationCount,
  };

  // 4. Finalize anchor confidence using the agreeing-source count.
  let anchor: AnchorConfidence;
  const hasOaSignal = !!oa && (oa.matchSignals?.includes("institution_match") || oa.matchSignals?.includes("field_match"));

  if (input.orcidAuthenticated) {
    // OAuth ownership proof: no name-collision or impersonation possible.
    // Unconditionally high — the applicant signed in to ORCID.
    anchor = "high";
  } else if (deterministic) {
    anchor = "high";
  } else if (oaUsable) {
    if (hasOaSignal || agreeingFromChecked.length >= 2) {
      basis = "openalex_corroborated";
      anchor = "high";
      // TRU-4: plausibility guard for institution/field-signal anchors.
      // Only fires when OA's signal is the SOLE reason for the upgrade (no
      // other independent source corroborates). If DBLP/arXiv/etc. also agree,
      // we have cross-source evidence and don't downgrade. Threshold: OA works
      // ≥ max(50, claimed × 10). Tunable against DATA-1.
      if (
        hasOaSignal &&
        agreeingFromChecked.length === 0 &&
        !input.orcidAuthenticated &&
        input.claimedPublicationCount &&
        input.claimedPublicationCount > 0 &&
        oa &&
        oa.worksCount >= Math.max(50, input.claimedPublicationCount * 10)
      ) {
        basis = "openalex_name";
        anchor = "medium";
        reasons.push(
          `TRU-4: institution-signal anchor downgraded — OA record has ${oa.worksCount} works, applicant claims ${input.claimedPublicationCount} (${Math.round(oa.worksCount / input.claimedPublicationCount)}× ratio); identity publicly corroborated but ownership unconfirmed`,
        );
      }
    } else {
      anchor = "medium";
    }
  } else if (orcidById) {
    // Applicant provided their ORCID iD; we fetched the real record and name-guarded it.
    // This is stronger than a name-search hit: medium confidence, DOI cross-check counts.
    anchor = "medium";
  } else if (ambiguous) {
    // TRU-7: cross-source rescue. An "ambiguous" OpenAlex result almost always
    // means OA resolved a prolific NAMESAKE sitting on top of a common-name
    // search (the IEEE-Fellow "Saifur Rahman" above the grad student). It must
    // not silently veto the genuinely independent sources. If ≥2 NON-OpenAlex
    // sources agree on a record whose SCALE is consistent with the applicant's
    // OWN self-report (not a namesake's inflated career), anchor on THOSE
    // sources and drop the OA namesake.
    //
    // The scale gate is what keeps the name-collision guard intact: the
    // internal-medicine clinician who inherits a 102-pub ORCID + 53-paper S2
    // under a claim of 8 has sources that DWARF the claim → they fail the gate
    // → anchor stays low (exactly as before). Only modest, claim-consistent
    // convergence rescues — which is the honest researcher, never the namesake.
    const claim = input.claimedPublicationCount;
    const scaleConsistent = (s: VerificationSource): boolean => {
      const w = sourceWorkCount[s];
      if (w === undefined) return false;
      if (!claim || claim <= 0) return false; // no self-report → can't bound scale, stay cautious
      return w <= Math.max(claim * 4, 10); // under-indexing is fine; dwarfing the claim is the namesake tell
    };
    const rescuers = agreeingFromChecked.filter(scaleConsistent);
    if (rescuers.length >= 2) {
      basis = "sources_only";
      anchor = "medium";
      // Demote the inflated (namesake-scale) agreeing sources so their numbers
      // never leak into the score or the attorney's per-claim table.
      for (const s of agreeingFromChecked) {
        if (!rescuers.includes(s)) {
          verdicts[s] = "unconfirmed";
          reasons.push(`${s}: not credited — record scale far exceeds the applicant's stated output (probable namesake)`);
        }
      }
      reasons.push(
        `TRU-7: OpenAlex match ambiguous (probable namesake) — identity anchored on ${rescuers.length} independent source(s) consistent with the self-report: ${rescuers.join(", ")}`,
      );
    } else {
      anchor = "low";
    }
  } else if (orcid) {
    anchor = orcid.confidence >= 0.6 ? "medium" : "low";
  } else if (agreeingFromChecked.length > 0) {
    basis = "sources_only";
    anchor = agreeingFromChecked.length >= 2 ? "medium" : "low";
  } else {
    anchor = "none";
  }

  // 5. US-only sources: credit only under a confident (high) anchor.
  const usOnly: VerificationSource[] = [];
  if ((input.nsfGrants?.length ?? 0) > 0) usOnly.push("nsf");
  if ((input.nihGrants?.length ?? 0) > 0) usOnly.push("nih");
  if ((input.patents?.length ?? 0) > 0) usOnly.push("uspto");
  for (const s of usOnly) {
    if (anchor === "high") {
      verdicts[s] = "agree";
    } else {
      verdicts[s] = "unconfirmed";
      reasons.push(`${s}: US-only name match not credited — identity not independently confirmed`);
    }
  }

  // 6. Under a low (ambiguous) anchor we cannot trust name-search
  //    corroboration at all: demote every "agree" to "unconfirmed" so the
  //    trust floor stays low and the attorney sees honest "ambiguous" badges.
  if (anchor === "low" && (ambiguous || basis === "orcid_only")) {
    for (const key of Object.keys(verdicts) as VerificationSource[]) {
      if (verdicts[key] === "agree") {
        verdicts[key] = "unconfirmed";
        reasons.push(`${key}: not credited — anchor identity is uncertain`);
      }
    }
  }

  const agreeingSources = (Object.entries(verdicts) as [VerificationSource, SourceVerdict][])
    .filter(([, v]) => v === "agree")
    .map(([s]) => s);

  // 7. Overclaim checks (the ONLY trust penalty) are enabled ONLY for an
  //    IDENTITY-ANCHORED record — one fetched by the applicant's own ORCID iD
  //    or OAuth, so we actually know their COMPLETE output. A name-search match,
  //    however well corroborated, is never complete enough to accuse anyone of
  //    overclaiming: public indexes lag, fragment, and undercount — badly for
  //    junior and international researchers (a real PhD candidate with 50+
  //    citations on Google Scholar can show as "4 works, 0 citations" across the
  //    APIs that happened to match her name). For every non-ID-anchored case we
  //    credit what we find and NEVER subtract ("drop, don't punish").
  const idAnchored =
    basis === "orcid_oauth" ||
    basis === "orcid_deterministic" ||
    basis === "orcid_provided";
  const claimCheckEnabled = idAnchored;

  if (anchor !== "none") {
    reasons.unshift(`anchor=${anchor} (${basis}); field=${resolvedField}; ${agreeingSources.length} corroborating source(s)`);
  }

  return {
    anchor,
    basis,
    resolvedField,
    verdicts,
    agreeingSources,
    claimCheckEnabled,
    reasons,
  };
}
