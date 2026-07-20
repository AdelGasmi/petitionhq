/**
 * Verification orchestrator.
 *
 * Takes a Lead, decides which lookups to run based on formData,
 * fans them out in parallel, aggregates into verifiedClaims,
 * computes trustScore, advances maturity, writes LeadVerificationEvent rows.
 */

import { prisma } from "@/lib/prisma";
import logger from "@/lib/logger";
import { trackFunnel } from "@/lib/funnel";
import { hasCompletedDeepIntake, M7_TRUST_THRESHOLD, type LeadMaturity } from "@/lib/leadMaturity";
import { findAuthor, getAuthorWorks } from "./openalex";
import { findOrcid, fetchOrcidById } from "./orcid";
import { findInstitution, getInstitutionById } from "./ror";
import { resolveDoi } from "./crossref";
import { findGrants as findNsfGrants } from "./nsf";
import { findGrants as findNihGrants } from "./nih";
import { findPatents } from "./uspto";
import { findAuthor as findS2Author } from "./semantic-scholar";
import { findPapers as findArxivPapers } from "./arxiv";
import { findAuthor as findDblpAuthor } from "./dblp";
import { findAuthor as findPubmedAuthor } from "./pubmed";
import { computeTrustScore, type ScoringInput } from "./scoring";
import { detectField, type ResearchField } from "./fields";
import { deriveVerificationLevel } from "./level";
import type {
  ClaimResult,
  ClaimStatus,
  VerificationSource,
  OpenAlexAuthor,
  OrcidProfile,
  RorOrg,
  Grant,
  Patent,
  CrossrefWork,
  SemanticScholarAuthor,
  ArxivResult,
  DblpResult,
  PubmedResult,
} from "./types";

// ─── Types ──────────────────────────────────────────────────────────

type VerifyReason = "intake_complete" | "manual" | "backfill" | "reverify" | "orcid_oauth";

type VerifyOpts = {
  reason?: VerifyReason;
  skip?: VerificationSource[];
};

type VerifyResult = {
  trustScore: number;
  verifiedClaims: Record<string, ClaimResult>;
  eventCount: number;
  newMaturity: LeadMaturity;
  scoringBreakdown: { rule: string; points: number; reason: string }[];
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Parse a wizard value that may be a number, a range string ("11-25"),
 * or a label like "More than 25" / "None".
 *
 * Returns the representative numeric value (midpoint for ranges,
 * lower-bound+5 for "More than X", 0 for "None").
 */
function parseFormDataNumber(formData: Record<string, unknown>, key: string): number | undefined {
  const val = formData[key];
  if (val === undefined || val === null || val === "") return undefined;
  if (typeof val === "number") return val;

  const s = String(val).trim();
  if (/^none$/i.test(s)) return 0;

  // "More than X" / "X or more" / "X+"
  const moreMatch = s.match(/(?:more\s+than|over|>)\s*(\d+)/i) ?? s.match(/(\d+)\s*(?:or\s+more|\+)/i);
  if (moreMatch) return parseInt(moreMatch[1], 10) + 5;

  // Range: "11-25" or "11 - 25"
  const rangeMatch = s.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
  if (rangeMatch) {
    const lo = parseInt(rangeMatch[1], 10);
    const hi = parseInt(rangeMatch[2], 10);
    return Math.round((lo + hi) / 2); // midpoint
  }

  // Plain number
  const n = parseInt(s, 10);
  return isNaN(n) ? undefined : n;
}

function shouldSkip(source: VerificationSource, skip?: VerificationSource[]): boolean {
  return skip?.includes(source) ?? false;
}

function resolveName(fd: Record<string, unknown>, leadName?: string | null): string {
  const combined =
    fd.name ??
    fd.fullName ??
    (fd.firstName && fd.lastName ? `${fd.firstName} ${fd.lastName}` : null);
  if (combined) return String(combined).trim();
  return leadName ? String(leadName).trim() : "";
}

async function writeEvent(
  leadId: string,
  source: VerificationSource,
  action: string,
  result: "verified" | "contradicted" | "inconclusive" | "not_found",
  opts: {
    claimKey?: string;
    evidenceRef?: string;
    confidenceScore?: number;
    rawResponse?: unknown;
    attorneyVisible?: boolean;
  } = {},
): Promise<void> {
  try {
    await prisma.leadVerificationEvent.create({
      data: {
        leadId,
        source,
        action,
        result,
        claimKey: opts.claimKey,
        evidenceRef: opts.evidenceRef,
        confidenceScore: opts.confidenceScore,
        rawResponse: opts.rawResponse ? JSON.parse(JSON.stringify(opts.rawResponse)) : undefined,
        attorneyVisible: opts.attorneyVisible ?? false,
      },
    });
  } catch (e) {
    logger.error(`[orchestrator] Failed to write event for ${leadId}:`, e);
  }
}

function claimResult(
  status: ClaimStatus,
  source: VerificationSource,
  opts: { sourceUrl?: string; confidence?: number; detail?: string } = {},
): ClaimResult {
  return {
    status,
    source,
    sourceUrl: opts.sourceUrl,
    confidence: opts.confidence ?? 0,
    detail: opts.detail,
    verifiedAt: new Date().toISOString(),
  };
}

// ─── Source routing ─────────────────────────────────────────────────

async function runOpenAlex(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<OpenAlexAuthor | null> {
  const name = resolveName(formData);
  const institution = String(formData.institution ?? formData.university ?? "");
  const field = String(formData.field ?? "");
  const orcid = formData.orcid ? String(formData.orcid).trim() : undefined;
  const claimedPublicationCount = parseFormDataNumber(formData, "publications");

  if (!name) {
    await writeEvent(leadId, "openalex", "author_lookup", "not_found", {
      claimKey: "researcher_profile",
    });
    return null;
  }

  const author = await findAuthor({
    name,
    institution,
    field,
    orcid,
    claimedPublicationCount,
  });

  if (author) {
    const isAmbiguous = author.matchQuality === "ambiguous";
    const status: ClaimStatus = isAmbiguous ? "ambiguous" : "verified";

    claims.researcher_profile = claimResult(status, "openalex", {
      sourceUrl: author.sourceUrl,
      confidence: author.confidence,
      detail: isAmbiguous
        ? `Ambiguous match: ${author.worksCount} pubs, ${author.citedByCount} cit. — may not be correct person`
        : `${author.worksCount} publications, ${author.citedByCount} citations, h-index ${author.hIndex}`,
    });

    claims.publications = claimResult(status, "openalex", {
      sourceUrl: author.sourceUrl,
      confidence: author.confidence,
      detail: isAmbiguous
        ? `${author.worksCount} publications found — identity uncertain`
        : `${author.worksCount} publications found`,
    });

    await writeEvent(
      leadId,
      "openalex",
      "author_lookup",
      isAmbiguous ? "inconclusive" : "verified",
      {
        claimKey: "researcher_profile",
        evidenceRef: author.sourceUrl,
        confidenceScore: author.confidence,
        attorneyVisible: true,
      },
    );
  } else {
    claims.researcher_profile = claimResult("not_found", "openalex", {
      detail: "No matching author profile found in OpenAlex",
    });

    await writeEvent(leadId, "openalex", "author_lookup", "not_found", {
      claimKey: "researcher_profile",
    });
  }

  return author;
}

async function runOrcid(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<OrcidProfile | null> {
  const name = resolveName(formData);
  const institution = String(formData.institution ?? formData.university ?? "");
  const email = String(formData.email ?? "");
  const orcidId = formData.orcid ? String(formData.orcid).trim() : undefined;

  if (!name) return null;

  // When the applicant provided their ORCID iD, fetch by iD first — this bypasses
  // the name-collision problem that makes thin-profile researchers score low.
  // Fall back to name search if the iD lookup fails or name guard rejects.
  let profile: OrcidProfile | null = null;
  if (orcidId) {
    profile = await fetchOrcidById(orcidId, name);
  }
  if (!profile) {
    profile = await findOrcid({ name, institution, email });
  }

  if (profile) {
    const byId = profile.fetchedById === true;
    claims.orcid = claimResult("verified", "orcid", {
      sourceUrl: profile.sourceUrl,
      confidence: profile.confidence,
      detail: byId
        ? `${profile.publicationCount} publications (verified by ORCID iD)`
        : `${profile.publicationCount} publications`,
    });

    await writeEvent(leadId, "orcid", "profile_lookup", "verified", {
      claimKey: "orcid",
      evidenceRef: profile.sourceUrl,
      confidenceScore: profile.confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "orcid", "profile_lookup", "not_found", {
      claimKey: "orcid",
    });
  }

  return profile;
}

async function runRor(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<RorOrg | null> {
  const institution = String(formData.institution ?? formData.university ?? "");
  const rorId = String(formData.institutionRorId ?? "");

  if (!institution && !rorId) return null;

  // If the applicant picked an institution from the typeahead, we stored its
  // exact ROR ID — resolve it directly instead of re-running a fuzzy name
  // search (which is what once mismatched NYU → "NYU Florence, Italy").
  const org = rorId
    ? (await getInstitutionById(rorId)) ?? (institution ? await findInstitution(institution) : null)
    : await findInstitution(institution);

  if (org) {
    claims.institution = claimResult("verified", "ror", {
      sourceUrl: org.sourceUrl,
      confidence: org.confidence,
      detail: `${org.name} (${org.country}, type: ${org.types.join(", ")})`,
    });

    await writeEvent(leadId, "ror", "institution_lookup", "verified", {
      claimKey: "institution",
      evidenceRef: org.sourceUrl,
      confidenceScore: org.confidence,
      attorneyVisible: true,
    });
  } else {
    claims.institution = claimResult("not_found", "ror", {
      detail: `"${institution}" not found in Research Organization Registry`,
    });

    await writeEvent(leadId, "ror", "institution_lookup", "not_found", {
      claimKey: "institution",
    });
  }

  return org;
}

async function runNsf(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<Grant[]> {
  const name = resolveName(formData);
  if (!name) return [];

  const institution = String(formData.institution ?? formData.university ?? "") || undefined;
  const grants = await findNsfGrants(name, institution);

  if (grants.length > 0) {
    claims.nsf_grants = claimResult("verified", "nsf", {
      sourceUrl: grants[0].sourceUrl,
      confidence: grants[0].confidence,
      detail: `${grants.length} NSF award(s) found`,
    });

    await writeEvent(leadId, "nsf", "grant_match", "verified", {
      claimKey: "nsf_grants",
      evidenceRef: grants[0].sourceUrl,
      confidenceScore: grants[0].confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "nsf", "grant_match", "not_found", {
      claimKey: "nsf_grants",
    });
  }

  return grants;
}

async function runNih(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<Grant[]> {
  const name = resolveName(formData);
  if (!name) return [];

  const institution = String(formData.institution ?? formData.university ?? "") || undefined;
  const grants = await findNihGrants(name, institution);

  if (grants.length > 0) {
    claims.nih_grants = claimResult("verified", "nih", {
      sourceUrl: grants[0].sourceUrl,
      confidence: grants[0].confidence,
      detail: `${grants.length} NIH project(s) found`,
    });

    await writeEvent(leadId, "nih", "grant_match", "verified", {
      claimKey: "nih_grants",
      evidenceRef: grants[0].sourceUrl,
      confidenceScore: grants[0].confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "nih", "grant_match", "not_found", {
      claimKey: "nih_grants",
    });
  }

  return grants;
}

async function runUspto(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<Patent[]> {
  const name = resolveName(formData);
  if (!name) return [];

  const patents = await findPatents(name);

  if (patents.length > 0) {
    claims.patents = claimResult("verified", "uspto", {
      sourceUrl: patents[0].sourceUrl,
      confidence: patents[0].confidence,
      detail: `${patents.length} patent(s) found`,
    });

    await writeEvent(leadId, "uspto", "patent_match", "verified", {
      claimKey: "patents",
      evidenceRef: patents[0].sourceUrl,
      confidenceScore: patents[0].confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "uspto", "patent_match", "not_found", {
      claimKey: "patents",
    });
  }

  return patents;
}

async function runSemanticScholar(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<SemanticScholarAuthor | null> {
  const name = resolveName(formData);
  if (!name) return null;

  const institution = String(formData.institution ?? formData.university ?? "") || undefined;
  const author = await findS2Author({ name, institution });

  if (author) {
    claims.semantic_scholar = claimResult("verified", "semantic_scholar", {
      sourceUrl: author.sourceUrl,
      confidence: author.confidence,
      detail: `${author.paperCount} papers, ${author.citationCount} citations, ${author.influentialCitationCount} influential citations, h-index ${author.hIndex}`,
    });

    await writeEvent(leadId, "semantic_scholar", "author_lookup", "verified", {
      claimKey: "semantic_scholar",
      evidenceRef: author.sourceUrl,
      confidenceScore: author.confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "semantic_scholar", "author_lookup", "not_found", {
      claimKey: "semantic_scholar",
    });
  }

  return author;
}

async function runArxiv(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<ArxivResult | null> {
  const name = resolveName(formData);
  if (!name) return null;

  const field = String(formData.field ?? "") || undefined;
  const result = await findArxivPapers({ name, field });

  if (result) {
    claims.arxiv_preprints = claimResult("verified", "arxiv", {
      sourceUrl: result.sourceUrl,
      confidence: result.confidence,
      detail: `${result.paperCount} preprint(s) found on arXiv`,
    });

    await writeEvent(leadId, "arxiv", "preprint_search", "verified", {
      claimKey: "arxiv_preprints",
      evidenceRef: result.sourceUrl,
      confidenceScore: result.confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "arxiv", "preprint_search", "not_found", {
      claimKey: "arxiv_preprints",
    });
  }

  return result;
}

async function runDblp(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<DblpResult | null> {
  const name = resolveName(formData);
  if (!name) return null;

  const institution = String(formData.institution ?? formData.university ?? "") || undefined;
  const result = await findDblpAuthor({ name, institution });

  if (result) {
    const venueDetail = result.topVenues.length > 0
      ? ` (top venues: ${result.topVenues.slice(0, 5).join(", ")})`
      : "";
    claims.dblp_publications = claimResult("verified", "dblp", {
      sourceUrl: result.sourceUrl,
      confidence: result.confidence,
      detail: `${result.publicationCount} CS publications (${result.venueBreakdown.conferences} conference, ${result.venueBreakdown.journals} journal)${venueDetail}`,
    });

    await writeEvent(leadId, "dblp", "author_lookup", "verified", {
      claimKey: "dblp_publications",
      evidenceRef: result.sourceUrl,
      confidenceScore: result.confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "dblp", "author_lookup", "not_found", {
      claimKey: "dblp_publications",
    });
  }

  return result;
}

async function runPubmed(
  leadId: string,
  formData: Record<string, unknown>,
  claims: Record<string, ClaimResult>,
): Promise<PubmedResult | null> {
  const name = resolveName(formData);
  if (!name) return null;

  const result = await findPubmedAuthor({ name });

  if (result) {
    claims.pubmed_publications = claimResult("verified", "pubmed", {
      sourceUrl: result.sourceUrl,
      confidence: result.confidence,
      detail: `${result.paperCount} PubMed-indexed article(s) (${result.recentCount} in the last 5 years)`,
    });

    await writeEvent(leadId, "pubmed", "author_lookup", "verified", {
      claimKey: "pubmed_publications",
      evidenceRef: result.sourceUrl,
      confidenceScore: result.confidence,
      attorneyVisible: true,
    });
  } else {
    await writeEvent(leadId, "pubmed", "author_lookup", "not_found", {
      claimKey: "pubmed_publications",
    });
  }

  return result;
}

// ─── Main orchestrator ──────────────────────────────────────────────

/**
 * Verify a lead: fan out API lookups, aggregate results, compute trust score.
 *
 * Idempotent: running twice produces the same verifiedClaims. The second run
 * does NOT duplicate events (events are append-only but the claims map is
 * replaced, not merged).
 */
export async function verifyLead(
  leadId: string,
  opts: VerifyOpts = {},
): Promise<VerifyResult> {
  const { reason = "manual", skip } = opts;

  // Load lead
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const formData = (lead.formData ?? {}) as Record<string, unknown>;

  // Fall back to lead-level name if formData is sparse
  if (!formData.name && !formData.fullName && !formData.firstName && lead.name) {
    formData.name = lead.name;
  }

  const claims: Record<string, ClaimResult> = {};

  // Detect research field up front so we can route field-specific sources
  // (e.g. PubMed for biomed) and tell the scorer which sources are even
  // expected — so the absence of an irrelevant one never costs the lead.
  const field: ResearchField = detectField({
    selfReported: String(formData.field ?? formData.researchField ?? ""),
  });

  logger.info(`[orchestrator] Verifying lead ${leadId} (reason: ${reason}, field: ${field})`);

  // PubMed is field-primary for biomed/life-sciences and prone to
  // false positives for common names elsewhere — only run it for biomed.
  const runPubmedForField = field === "biomed" && !shouldSkip("pubmed", skip);

  // Fan out lookups in parallel with Promise.allSettled
  const [
    openalexResult,
    orcidResult,
    rorResult,
    nsfResult,
    nihResult,
    usptoResult,
    s2Result,
    arxivResult,
    dblpResult,
    pubmedResult,
  ] = await Promise.allSettled([
    shouldSkip("openalex", skip) ? Promise.resolve(null) : runOpenAlex(leadId, formData, claims),
    shouldSkip("orcid", skip) ? Promise.resolve(null) : runOrcid(leadId, formData, claims),
    shouldSkip("ror", skip) ? Promise.resolve(null) : runRor(leadId, formData, claims),
    shouldSkip("nsf", skip) ? Promise.resolve([]) : runNsf(leadId, formData, claims),
    shouldSkip("nih", skip) ? Promise.resolve([]) : runNih(leadId, formData, claims),
    shouldSkip("uspto", skip) ? Promise.resolve([]) : runUspto(leadId, formData, claims),
    shouldSkip("semantic_scholar", skip) ? Promise.resolve(null) : runSemanticScholar(leadId, formData, claims),
    shouldSkip("arxiv", skip) ? Promise.resolve(null) : runArxiv(leadId, formData, claims),
    shouldSkip("dblp", skip) ? Promise.resolve(null) : runDblp(leadId, formData, claims),
    runPubmedForField ? runPubmed(leadId, formData, claims) : Promise.resolve(null),
  ]);

  // Extract settled values (failures produce null/[])
  const openalex = openalexResult.status === "fulfilled" ? openalexResult.value : null;
  const orcid = orcidResult.status === "fulfilled" ? orcidResult.value : null;
  const ror = rorResult.status === "fulfilled" ? rorResult.value : null;
  const nsfGrants = nsfResult.status === "fulfilled" ? nsfResult.value : [];
  const nihGrants = nihResult.status === "fulfilled" ? nihResult.value : [];
  const patents = usptoResult.status === "fulfilled" ? usptoResult.value : [];
  const semanticScholar = s2Result.status === "fulfilled" ? s2Result.value : null;
  const arxiv = arxivResult.status === "fulfilled" ? arxivResult.value : null;
  const dblp = dblpResult.status === "fulfilled" ? dblpResult.value : null;
  const pubmed = pubmedResult.status === "fulfilled" ? pubmedResult.value : null;

  // Log any failures (non-fatal — other sources still produce data)
  for (const [name, result] of Object.entries({
    openalex: openalexResult,
    orcid: orcidResult,
    ror: rorResult,
    nsf: nsfResult,
    nih: nihResult,
    uspto: usptoResult,
    semantic_scholar: s2Result,
    arxiv: arxivResult,
    dblp: dblpResult,
    pubmed: pubmedResult,
  })) {
    if (result.status === "rejected") {
      logger.error(`[orchestrator] ${name} failed:`, result.reason);
    }
  }

  // ── Institution affiliation cross-reference ────────────────────────
  // ROR confirms the institution *exists*. Now check whether the
  // applicant is actually *affiliated* with it via OpenAlex records.
  if (claims.institution?.status === "verified" && ror) {
    const hasConfirmedAuthor = openalex && openalex.matchQuality !== "ambiguous";
    if (!hasConfirmedAuthor) {
      claims.institution = claimResult("self_reported", "ror", {
        sourceUrl: ror.sourceUrl,
        confidence: 0,
        detail: `${ror.name} (${ror.country}) — no confirmed author profile to verify affiliation`,
      });
      await writeEvent(leadId, "ror", "affiliation_cross_ref", "inconclusive", {
        claimKey: "institution",
        evidenceRef: ror.sourceUrl,
      });
    } else {
      const authorRorIds = openalex.affiliationRorIds ?? [];
      const claimedId = ror.id.replace(/\/$/, "");
      const affiliated = authorRorIds.some(
        (id) => id.replace(/\/$/, "") === claimedId,
      );

      if (affiliated) {
        await writeEvent(leadId, "ror", "affiliation_cross_ref", "verified", {
          claimKey: "institution",
          evidenceRef: ror.sourceUrl,
          confidenceScore: 1,
        });
      } else {
        claims.institution = claimResult("self_reported", "ror", {
          sourceUrl: ror.sourceUrl,
          confidence: 0,
          detail: `${ror.name} (${ror.country}) exists but not found in author's OpenAlex affiliations`,
        });
        await writeEvent(leadId, "ror", "affiliation_cross_ref", "inconclusive", {
          claimKey: "institution",
          evidenceRef: ror.sourceUrl,
          confidenceScore: 0,
        });
      }
    }
  }

  // ── Crossref chaining ──────────────────────────────────────────────
  // After OpenAlex finds an author, grab their top works and verify
  // up to 3 DOIs via Crossref for independent citation cross-validation.
  let crossrefWorks: CrossrefWork[] = [];
  if (openalex && !shouldSkip("crossref", skip)) {
    try {
      const works = await getAuthorWorks(openalex.id, 5);
      const doisToCheck = works
        .map((w) => w.doi)
        .filter((doi): doi is string => !!doi)
        .slice(0, 3);

      if (doisToCheck.length > 0) {
        const crossrefResults = await Promise.allSettled(
          doisToCheck.map((doi) => resolveDoi(doi)),
        );

        for (const cr of crossrefResults) {
          if (cr.status === "fulfilled" && cr.value) {
            crossrefWorks.push(cr.value);
          }
        }

        if (crossrefWorks.length > 0) {
          claims.crossref_citations = claimResult("verified", "crossref", {
            sourceUrl: crossrefWorks[0].sourceUrl,
            confidence: 0.9,
            detail: `${crossrefWorks.length} publication(s) independently verified via Crossref`,
          });

          await writeEvent(leadId, "crossref", "doi_cross_validation", "verified", {
            claimKey: "crossref_citations",
            evidenceRef: crossrefWorks[0].sourceUrl,
            confidenceScore: 0.9,
            attorneyVisible: true,
          });
        }
      }
    } catch (e) {
      logger.warn("[orchestrator] Crossref chaining failed (non-fatal):", e);
    }
  }

  // ── ORCID-DOI Crossref cross-check ────────────────────────────────
  // When the applicant provided their ORCID iD and we fetched it directly,
  // verify up to 3 of their ORCID-recorded DOIs via Crossref for an independent
  // second corroborating source. This is separate from the OA-based crossref
  // check: for thin-profile researchers whose works aren't fully indexed in
  // OpenAlex, ORCID DOIs give us a reliable alternative cross-check path.
  if (orcid?.fetchedById && (orcid.dois?.length ?? 0) > 0 && !shouldSkip("crossref", skip)) {
    try {
      const orcidDois = (orcid.dois ?? []).slice(0, 3);
      const orcidCrossrefResults = await Promise.allSettled(
        orcidDois.map((doi) => resolveDoi(doi)),
      );
      for (const cr of orcidCrossrefResults) {
        if (cr.status === "fulfilled" && cr.value) {
          crossrefWorks.push(cr.value);
        }
      }
      if (crossrefWorks.length > 0 && !claims.crossref_citations) {
        claims.crossref_citations = claimResult("verified", "crossref", {
          sourceUrl: crossrefWorks[0].sourceUrl,
          confidence: 0.9,
          detail: `${crossrefWorks.length} publication(s) independently verified via Crossref`,
        });
        await writeEvent(leadId, "crossref", "doi_cross_validation", "verified", {
          claimKey: "crossref_citations",
          evidenceRef: crossrefWorks[0].sourceUrl,
          confidenceScore: 0.9,
          attorneyVisible: true,
        });
      }
    } catch (e) {
      logger.warn("[orchestrator] ORCID-DOI Crossref check failed (non-fatal):", e);
    }
  }

  // Compute trust score
  const scoringInput: ScoringInput = {
    openalex,
    orcid,
    ror,
    nsfGrants,
    nihGrants,
    patents,
    crossrefWorks,
    semanticScholar,
    arxiv,
    dblp,
    pubmed,
    field,
    declaredField: String(formData.field ?? formData.researchField ?? "") || undefined,
    claimedPublicationCount: parseFormDataNumber(formData, "publications"),
    claimedCitationCount: parseFormDataNumber(formData, "citations"),
    claimedGrantCount: parseFormDataNumber(formData, "grants"),
    orcidAuthenticated: lead.orcidAuthenticated ?? false,
  };

  const { trustScore, breakdown, aggregatedCitations, aggregatedWorks, corroboratingSources, identity } =
    computeTrustScore(scoringInput);

  // ── Identity-reconciliation status downgrade ───────────────────────
  // A source that doesn't agree with the resolved identity (a CS-only DB hit
  // for a clinician, a name-search NSF award we can't tie to the applicant)
  // was stamped "verified" by its runX helper purely because the API returned
  // a name hit. Reconciliation knows better — surface it to the attorney as
  // "ambiguous" with the reason, instead of a false green badge.
  const VERDICT_CLAIM_KEYS: Partial<Record<VerificationSource, string[]>> = {
    orcid: ["orcid"],
    semantic_scholar: ["semantic_scholar"],
    dblp: ["dblp_publications"],
    arxiv: ["arxiv_preprints"],
    pubmed: ["pubmed_publications"],
    crossref: ["crossref_citations"],
    nsf: ["nsf_grants"],
    nih: ["nih_grants"],
    uspto: ["patents"],
  };
  for (const [source, verdict] of Object.entries(identity.verdicts) as [VerificationSource, string][]) {
    if (verdict === "agree") continue;
    const note =
      verdict === "field_mismatch"
        ? `Possible namesake — this record's field does not match the applicant's (${identity.resolvedField}); not counted toward trust`
        : verdict === "magnitude_mismatch"
        ? "Possible namesake — output far exceeds the ORCID-resolved record; not counted toward trust"
        : "Found by name match, but the applicant's identity could not be independently confirmed; not counted toward trust";
    for (const key of VERDICT_CLAIM_KEYS[source] ?? []) {
      const existing = claims[key];
      if (existing && existing.status === "verified") {
        claims[key] = claimResult("ambiguous", source, {
          sourceUrl: existing.sourceUrl,
          confidence: 0,
          detail: existing.detail ? `${existing.detail} — ${note}` : note,
        });
      }
    }
  }

  // TRU-1: persist the verification level (three-tier) so all downstream
  // surfaces (attorney view, marketplace cards, PDF) can render consistently
  // without re-deriving from anchor/basis.
  claims._verificationLevel = claimResult("verified", "openalex", {
    detail: deriveVerificationLevel(identity.anchor, identity.basis),
    confidence: 1,
  });

  // Persist Scholar-comparable aggregate facts for surfacing to attorney
  // and applicant (max across free sources, not any single database).
  claims._aggregate = claimResult("verified", "openalex", {
    detail: `Field: ${field}; ${aggregatedWorks} works, ${aggregatedCitations} citations aggregated across ${corroboratingSources.length} source(s): ${corroboratingSources.join(", ") || "none"}`,
    confidence: corroboratingSources.length > 0 ? 1 : 0,
  });

  // Emit contradiction funnel events for material discrepancies
  const contradictions = breakdown.filter((b) => b.points < 0 && b.rule !== "no_sources_found");
  for (const c of contradictions) {
    trackFunnel({
      event: "verification.contradiction_flagged",
      leadId,
      props: { rule: c.rule, reason: c.reason },
    });
  }

  // Self-reported claims: anything in formData that wasn't verified
  const selfReportedFields = [
    { key: "awards", label: "Awards" },
    { key: "peerReview", label: "Peer review roles" },
    { key: "invitedTalks", label: "Invited talks" },
  ];

  for (const { key, label } of selfReportedFields) {
    if (formData[key] && !claims[key]) {
      claims[key] = claimResult("self_reported", "openalex" /* placeholder */, {
        detail: `${label}: ${String(formData[key])}`,
      });
    }
  }

  // ── M7 (attorney-ready) gate ───────────────────────────────────────
  // The dossier (M4) is generated post-claim by the cron (`caseId` required),
  // so a lead can never legitimately reach M4 during the applicant funnel —
  // M7 is promoted directly from the consent step. We gate it HARD: a lead
  // becomes marketplace-visible ONLY when it
  //   1. genuinely completed the deep assessment (not a light-only lead whose
  //      deep step was never done or was silently dropped client-side),
  //   2. the applicant consented to attorney matching, and
  //   3. the trust score clears the bar (identity corroborated — see scoring).
  // We never synthesize maturity past what the lead legitimately reached, so an
  // incomplete, unconsented, or low-trust/uncorroborated lead stays out of the
  // marketplace. (Replaces the old unconditional M1→…→M7 fast-forward that put
  // half-baked leads in front of paying attorneys.)
  const currentMaturity = lead.maturity as LeadMaturity;
  const attorneyReady =
    trustScore >= M7_TRUST_THRESHOLD &&
    hasCompletedDeepIntake(formData) &&
    lead.applicantStatus === "approved";

  // Maturity must stay HONEST on every run, including demotion. The old
  // fast-forward (and any earlier false-positive author match that briefly
  // cleared the trust bar) could leave a lead stranded at M7 after its trust
  // basis collapsed — a trust-0 lead sitting in the attorney marketplace.
  //
  // Rules:
  //  - attorney-ready  → M7
  //  - already claimed → never yank it out from under its owning attorney
  //  - otherwise, if the lead is over-promoted (M4+ implies a post-claim
  //    dossier it can't legitimately have) → drop to its honest funnel floor
  //  - else keep its legitimate pre-M7 progress
  const isClaimed = Boolean(lead.claimedByUserId || lead.caseId);
  const honestFloor: LeadMaturity =
    lead.applicantStatus === "approved" ? "M3" : hasCompletedDeepIntake(formData) ? "M2" : "M1";
  const overPromoted = (["M4", "M5", "M6", "M7"] as LeadMaturity[]).includes(currentMaturity);

  let newMaturity: LeadMaturity;
  if (attorneyReady) newMaturity = "M7";
  else if (isClaimed) newMaturity = currentMaturity;
  else newMaturity = overPromoted ? honestFloor : currentMaturity;

  // Build maturity history entry
  const existingHistory = (lead.maturityHistory as Array<Record<string, unknown>>) ?? [];
  const maturityEntry = newMaturity !== currentMaturity
    ? [...existingHistory, { from: currentMaturity, to: newMaturity, at: new Date().toISOString(), trigger: `verification_${reason}` }]
    : existingHistory;

  // Count events written in this run
  const eventCount = await prisma.leadVerificationEvent.count({
    where: {
      leadId,
      createdAt: { gte: new Date(Date.now() - 60_000) }, // events from last minute
    },
  });

  // Derive 4-component subtotals from the breakdown and store for UI display.
  // Additive JSON: existing records without _breakdown simply show no bars.
  const CONSISTENCY_RULES = new Set([
    "publication_claim_consistent", "publication_claim_partial",
    "publication_claim_contradiction", "publication_claim_undercounted",
    "no_publication_claim", "citation_claim_high", "citation_claim_overclaim",
    "grant_claim_consistent", "grant_claim_unverified",
  ]);
  claims._breakdown = claimResult("verified", "openalex", {
    detail: JSON.stringify({
      identity: breakdown.find(b => b.rule === "identity_corroboration")?.points ?? 0,
      identityCap: 55,
      substance: breakdown.find(b => b.rule === "publication_substance")?.points ?? 0,
      substanceCap: 15,
      consistency: Math.max(-15, Math.min(20,
        breakdown.filter(b => CONSISTENCY_RULES.has(b.rule)).reduce((s, b) => s + b.points, 0)
      )),
      consistencyCap: 20,
      institution: Math.min(10,
        breakdown.filter(b => b.rule === "institution_funding").reduce((s, b) => s + b.points, 0)
      ),
      institutionCap: 10,
    }),
    confidence: 1,
  });

  // Update lead
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      trustScore,
      verifiedClaims: JSON.parse(JSON.stringify(claims)),
      maturity: newMaturity,
      maturityHistory: JSON.parse(JSON.stringify(maturityEntry)),
      lastVerifiedAt: new Date(),
    },
  });

  logger.info(`[orchestrator] Lead ${leadId}: trustScore=${trustScore}, maturity=${currentMaturity}→${newMaturity}, events=${eventCount}`);

  return {
    trustScore,
    verifiedClaims: claims,
    eventCount,
    newMaturity,
    scoringBreakdown: breakdown,
  };
}

/**
 * Quick ping — runs only OpenAlex + ROR (cheap, fast).
 * Used after light wizard to show teaser without blocking UX.
 */
export async function quickPing(
  leadId: string,
): Promise<{ found: boolean; matchConfidence?: number; worksCount?: number; citedByCount?: number; institution?: string }> {
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  const formData = (lead.formData ?? {}) as Record<string, unknown>;

  const name = resolveName(formData, lead.name);
  const institution = String(formData.institution ?? formData.university ?? "");
  const rorId = String(formData.institutionRorId ?? "");
  const field = String(formData.field ?? "");
  const orcid = formData.orcid ? String(formData.orcid).trim() : undefined;
  const claimedPublicationCount = parseFormDataNumber(formData, "publications");

  if (!name) return { found: false };

  const resolveInstitution = rorId
    ? getInstitutionById(rorId).then((org) => org ?? (institution ? findInstitution(institution) : null))
    : institution ? findInstitution(institution) : Promise.resolve(null);

  const [authorResult, rorResult] = await Promise.allSettled([
    findAuthor({ name, institution, field, orcid, claimedPublicationCount }),
    resolveInstitution,
  ]);

  const author = authorResult.status === "fulfilled" ? authorResult.value : null;
  const ror = rorResult.status === "fulfilled" ? rorResult.value : null;

  const preliminary = {
    found: !!author,
    matchConfidence: author?.confidence,
    worksCount: author?.worksCount,
    citedByCount: author?.citedByCount,
    institution: ror?.name ?? author?.institution,
  };

  // Store preliminary result on lead
  const existing = (lead.verifiedClaims ?? {}) as Record<string, unknown>;
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      verifiedClaims: JSON.parse(JSON.stringify({ ...existing, preliminary })),
    },
  });

  return preliminary;
}
