/**
 * Central SEO configuration for PetitionHQ.
 *
 * Single source of truth for site URL, brand metadata, default OG card,
 * and schema.org Organization fields. Imported by app/layout.tsx, sitemap,
 * robots, llms.txt route, and JSON-LD components.
 *
 * V1 SCOPE: EB-2 NIW only. Other categories are roadmap, not current
 * offering — keep copy honest. Update this file when scope expands.
 */

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://petitionhq.us";

export const BRAND = {
  name: "PetitionHQ",
  legalName: "PetitionHQ",
  domain: "petitionhq.us",
  // Short tagline used in <title>, OG, and Twitter. Keep under 60 chars
  // so Google doesn't truncate the SERP listing.
  // NEEDS FOUNDER REVIEW — dual-audience tagline
  tagline: "Free EB-2 NIW case-strength assessment.",
  // Longer marketing hook for hero H1 and landing pages. Don't put this
  // in <title> — it's too long and will get cut off in search results.
  // NEEDS FOUNDER REVIEW
  heroHook: "Know if your EB-2 NIW case is strong — before you spend $15,000 on an attorney.",
  // NEEDS FOUNDER REVIEW — triage-infra framing added
  description:
    "PetitionHQ helps immigration firms pre-screen NIW prospects and generate cleaner, evidence-grounded first drafts faster — fewer junk consults, faster inquiry-to-retainer, higher-quality NIW packets. For applicants: a free 5-minute credential check against the USCIS Dhanasar framework returns an honest tier rating, a prong-level gap analysis, and an AI-drafted evidence dossier before you spend five figures on a filing.",
  shortDescription:
    "Free EB-2 NIW case-strength assessment scored against the Matter of Dhanasar framework. Honest tier rating, prong-level gap analysis, AI-drafted evidence dossier.",
  keywords: [
    "EB-2 NIW",
    "EB-2 National Interest Waiver",
    "EB-2 NIW eligibility",
    "NIW case assessment",
    "Matter of Dhanasar",
    "Dhanasar prongs",
    "NIW evidence dossier",
    "NIW self-petition",
    "I-140 NIW",
    "EB-2 NIW for researchers",
    "EB-2 NIW for engineers",
    "EB-2 NIW for healthcare professionals",
    "EB-2 NIW for founders",
    "NIW recommender letters",
    "NIW eligibility check",
    "USCIS NIW petition",
    "advanced degree self-petition",
    "EB-2 NIW gap analysis",
    "NIW prong analysis",
    "NIW attorney matching",
  ],
  founderEmail: "hello@petitionhq.us",
  supportEmail: "support@petitionhq.us",
  privacyEmail: "privacy@petitionhq.us",
  social: {
    twitter: "@petitionhq",
    linkedin: "https://www.linkedin.com/company/petitionhq",
  },
  address: {
    addressCountry: "US",
  },
};

export const DEFAULT_OG_IMAGE = {
  url: `${SITE_URL}/og-default.png`,
  width: 1200,
  height: 630,
  alt: `${BRAND.name} — ${BRAND.tagline}`,
};

/** Build a canonical URL from a route path. Always begins with `/`. */
export function canonical(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_URL}${p === "/" ? "" : p}`;
}

/** Compose a page title with the brand suffix, unless the input already includes it. */
export function pageTitle(title: string): string {
  if (!title) return `${BRAND.name} — ${BRAND.tagline}`;
  if (title.toLowerCase().includes("petitionhq")) return title;
  return `${title} | ${BRAND.name}`;
}
