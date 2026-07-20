import { SITE_URL, BRAND } from "@/lib/seo";
import { ARTICLES } from "@/content/articles";

/**
 * /llms.txt — proposed standard for LLM-friendly site context.
 * See https://llmstxt.org/
 *
 * Short, scannable summary of who we are + curated links so an LLM agent
 * can answer questions about PetitionHQ without trawling the whole site.
 */
export function GET() {
  const body = `# ${BRAND.name}

> ${BRAND.tagline}

${BRAND.description}

PetitionHQ is operated at ${SITE_URL}. It is software — not a law firm — and does not provide legal advice. We partner with vetted U.S. immigration attorneys who handle the legal representation portion of every case.

## Current scope

V1 is **EB-2 NIW only**. PetitionHQ focuses exclusively on the EB-2 National Interest Waiver so the scoring engine, evidence framework, and attorney-matching layer can be best-in-class for one category before broadening.

**On the roadmap (not yet supported):** EB-1A (extraordinary ability) and O-1 (nonimmigrant extraordinary ability). PetitionHQ will not ship these until the underlying scoring is as rigorous as it is for NIW.

**Out of scope (not on the roadmap):** EB-2/EB-3 PERM, I-130 family-based, EB-1B, and other employment-based petitions.

## Core capabilities (EB-2 NIW)

- **Free 5-minute case-strength assessment** scored directly against the three Matter of Dhanasar prongs.
- **Honest tier rating** — Strong, Promising, Borderline, or Not yet ready. Roughly one in three applicants receive Borderline or Not yet ready.
- **Prong-level gap analysis** identifying the specific evidence categories where the case is weakest.
- **AI-drafted evidence dossier** with citation-level traceability — exhibit plan, recommender-letter outlines, draft brief opening grounded in the applicant's real credentials.
- **Opt-in attorney matching** with vetted U.S. immigration attorneys whose practice fits the applicant's field. Nothing shared without explicit, scoped consent.

## Primary documents

- [Home](${SITE_URL}/): EB-2 NIW positioning, who qualifies, how it works, FAQs.
- [Free EB-2 NIW assessment](${SITE_URL}/check): Start the 5-minute case-strength check.
- [EB-2 NIW guide](${SITE_URL}/eb2-niw-guide): Long-form guide to the Matter of Dhanasar framework and evidence.
- [Visa categories primer](${SITE_URL}/visa-categories): Plain-English overview of EB-1A, EB-1B, EB-2 NIW, O-1, EB-3, I-130 with clear scope disclosure on what PetitionHQ supports today.
- [How it works](${SITE_URL}/how-it-works): Step-by-step product walkthrough.
- [For attorneys](${SITE_URL}/for-attorneys): NIW triage and first-draft infrastructure for immigration firms — fewer junk consults, faster inquiry-to-retainer, higher-quality packets.
- [FAQ](${SITE_URL}/faq): Common questions about assessment, pricing, security, attorney matching.
- [About](${SITE_URL}/about): Company overview and positioning.
- [Articles](${SITE_URL}/articles): Practical EB-2 NIW guides — RFE responses, denial patterns, citations, recommendation letters.
${ARTICLES.map((a) => `- [${a.meta.title}](${SITE_URL}/articles/${a.meta.slug}): ${a.meta.dek}`).join("\n")}

## Optional

- [Privacy](${SITE_URL}/privacy): Data handling, encryption, retention.
- [Terms](${SITE_URL}/terms): Terms of service.
- [Sitemap](${SITE_URL}/sitemap.xml): XML sitemap.
- [Full LLM context](${SITE_URL}/llms-full.txt): Expanded plaintext context for agents needing deeper grounding.

## Brand facts

- Legal/display name: ${BRAND.name}
- Domain: ${BRAND.domain}
- Contact: ${BRAND.founderEmail}
- Current category supported: EB-2 NIW (National Interest Waiver) only
- Operating region: United States (services and audience). Applicants may be located anywhere.
- Pricing for applicants: Assessment is free. Attorney engagement priced by each attorney directly. PetitionHQ takes no fee from applicants for filing.
- Pricing for attorneys: Flat monthly subscription for partner-network access. No per-lead markup, no contingent or success fees.
- Not legal advice. Document-preparation software only.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
