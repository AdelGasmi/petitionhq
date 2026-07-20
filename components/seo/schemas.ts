/**
 * Schema.org JSON-LD builders.
 *
 * Each function returns a plain object passed to <JsonLd data={...} />.
 * Keep these structurally lean — Google ignores unknown fields but every
 * extra field is one more thing to keep correct.
 */

import { BRAND, SITE_URL, canonical } from "@/lib/seo";

const ORGANIZATION_ID = `${SITE_URL}#organization`;
const WEBSITE_ID = `${SITE_URL}#website`;

export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LegalService"],
    "@id": ORGANIZATION_ID,
    name: BRAND.name,
    legalName: BRAND.legalName,
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/icon.svg`,
      width: 512,
      height: 512,
    },
    image: `${SITE_URL}/og-default.png`,
    description: BRAND.description,
    slogan: BRAND.tagline,
    email: BRAND.founderEmail,
    areaServed: { "@type": "Country", name: "United States" },
    knowsAbout: [
      "EB-2 National Interest Waiver",
      "Matter of Dhanasar",
      "Dhanasar three-prong framework",
      "I-140 immigrant petition (EB-2 NIW)",
      "EB-2 NIW evidence preparation",
      "EB-2 NIW recommender letters",
      "USCIS NIW adjudication",
    ],
    foundingDate: "2024",
    sameAs: [BRAND.social.linkedin].filter(Boolean),
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: BRAND.supportEmail,
        availableLanguage: ["English"],
        areaServed: "US",
      },
      {
        "@type": "ContactPoint",
        contactType: "privacy",
        email: BRAND.privacyEmail,
      },
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: BRAND.name,
    description: BRAND.shortDescription,
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-US",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/check?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function serviceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "EB-2 NIW Case-Strength Assessment",
    serviceType: "EB-2 NIW Petition Preparation Software",
    provider: { "@id": ORGANIZATION_ID },
    areaServed: { "@type": "Country", name: "United States" },
    audience: {
      "@type": "Audience",
      audienceType:
        "Researchers, scientists, engineers, healthcare professionals, and founders pursuing a U.S. EB-2 National Interest Waiver self-petition",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description:
        "Free EB-2 NIW case-strength assessment with Dhanasar prong-level gap analysis and an AI-drafted evidence dossier.",
      availability: "https://schema.org/InStock",
      url: canonical("/check"),
    },
    termsOfService: canonical("/terms"),
    category: "EB-2 NIW Petition Preparation",
  };
}

export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND.name,
    operatingSystem: "Web",
    applicationCategory: "BusinessApplication",
    url: SITE_URL,
    description: BRAND.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: undefined, // Add when we have verifiable reviews.
    creator: { "@id": ORGANIZATION_ID },
  };
}

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: canonical(it.path),
    })),
  };
}

export function faqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}

export function articleSchema(opts: {
  title: string;
  description: string;
  path: string;
  datePublished: string;
  dateModified?: string;
  authorName?: string;
  sources?: Array<{ title: string; url: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical(opts.path),
    },
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: {
      "@type": "Organization",
      name: opts.authorName ?? BRAND.name,
      "@id": ORGANIZATION_ID,
      sameAs: [`${SITE_URL}/about`],
    },
    publisher: { "@id": ORGANIZATION_ID },
    image: `${SITE_URL}/og-default.png`,
    inLanguage: "en-US",
    ...(opts.sources && opts.sources.length > 0 && {
      citation: opts.sources.map((s) => ({
        "@type": "CreativeWork",
        name: s.title,
        url: s.url,
      })),
    }),
  };
}


export function howToSchema(opts: {
  name: string;
  description: string;
  steps: Array<{ name: string; text: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export function attorneyServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "PetitionHQ Attorney Partner Network",
    serviceType: "EB-2 NIW Lead Generation and Client Intake Software",
    provider: { "@id": ORGANIZATION_ID },
    areaServed: { "@type": "Country", name: "United States" },
    audience: {
      "@type": "Audience",
      audienceType: "U.S. immigration attorneys specializing in EB-2 National Interest Waiver",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      description: "$99/month marketplace access + $150 per lead claimed. Auto-refunded if applicant does not complete intake within 14 days.",
      availability: "https://schema.org/InStock",
      url: canonical("/for-attorneys"),
    },
    description: "Pre-screened EB-2 NIW leads delivered with structured intake packets: Dhanasar prong scoring, citation tables, exhibit plans, and AI-drafted brief sections. 14-day auto-refund on ghost leads. No contingency fees.",
    termsOfService: canonical("/terms"),
    category: "EB-2 NIW Attorney Lead Generation",
  };
}
