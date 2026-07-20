import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MobileMenu, type MobileMenuLink } from "@/components/MobileMenu";
import { PetitionMark } from "@/components/icons/PetitionMark";
import { JsonLd } from "@/components/seo/JsonLd";
import { organizationSchema, websiteSchema } from "@/components/seo/schemas";
import { BRAND, SITE_URL } from "@/lib/seo";
import { headers, cookies } from "next/headers";
import "./globals.css";

// Self-hosted via next/font — no Google CDN ping, no render-blocking @import,
// no CLS. The CSS vars are consumed by --font-display / --font-body in the theme.
const display = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" });
const body = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND.name} — ${BRAND.tagline}`,
    template: `%s | ${BRAND.name}`,
  },
  description: BRAND.description,
  keywords: BRAND.keywords,
  applicationName: BRAND.name,
  generator: "Next.js",
  authors: [{ name: BRAND.name, url: SITE_URL }],
  creator: BRAND.name,
  publisher: BRAND.name,
  category: "Legal Technology",
  alternates: {
    canonical: "/",
    languages: { "en-US": "/" },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: BRAND.name,
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    // OG image is auto-injected by Next.js from app/opengraph-image.tsx.
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — ${BRAND.tagline}`,
    description: BRAND.shortDescription,
    creator: BRAND.social.twitter,
    site: BRAND.social.twitter,
    // Card image auto-injected by Next.js from app/twitter-image.tsx.
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  formatDetection: { email: false, telephone: false, address: false },
  other: {
    // Hint AI assistants where to find machine-readable site context.
    "ai-content-declaration": "human-authored-with-ai-assistance",
  },
};

export const viewport: Viewport = {
  themeColor: "#1c1917",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  // Theme is cookie-driven so the SERVER renders <html data-theme> on every
  // request. This is required: layout is a server component, so a client-set
  // attribute would be wiped on the next navigation re-render. Opt-in only.
  const theme = (await cookies()).get("theme")?.value === "dark" ? "dark" : undefined;
  // /check is a public lead-gen funnel — always show marketing nav, even for logged-in staff
  const forcePublicNav = pathname.startsWith("/check");
  // On /network/* and /admin/* the in-app sub-nav already carries the links, so
  // suppress the global header's duplicate cluster there.
  const isNetworkPage = pathname.startsWith("/network");
  const isAdminPage = pathname.startsWith("/admin");

  // Links for the mobile hamburger (the desktop nav is hidden below md, and
  // non-/network pages have no sub-nav, so this is the only mobile nav path).
  const mobileLinks: MobileMenuLink[] = forcePublicNav || !session || session.guestCaseId
    ? []
    : session.role === "attorney"
    ? [
        { href: "/network/dashboard", label: "Dashboard" },
        { href: "/network/leads", label: "Leads" },
        { href: "/cases", label: "My cases" },
        { href: "/network/billing", label: "Billing" },
        { href: "/network/rules", label: "Rules" },
        { href: "/profile", label: "Profile" },
      ]
    : session.role === "admin"
    ? [
        { href: "/admin", label: "Dashboard" },
        { href: "/cases", label: "Cases" },
        { href: "/admin/leads", label: "Leads" },
        { href: "/admin/users", label: "Users" },
        { href: "/profile", label: "Profile" },
      ]
    : [
        { href: "/cases", label: "My case" },
        { href: "/profile", label: "Profile" },
      ];

  return (
    <html lang="en-US" data-theme={theme} className={`${display.variable} ${body.variable}`}>
      <head>
        <JsonLd data={organizationSchema()} />
        <JsonLd data={websiteSchema()} />
        {/* LLM-discoverable site context (emerging convention) */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM site context" />
      </head>
      <body className="min-h-screen bg-surface-canvas text-text-primary antialiased">
        <a
          href="#main"
          className="skip-link"
        >
          Skip to content
        </a>
        <header className="border-b border-border-default bg-surface-card">
          <div className="mx-auto flex max-w-content items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
            <Link href="/" className="flex items-center gap-2 shrink-0" aria-label={`${BRAND.name} home`}>
              <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-primary p-1.5">
                <PetitionMark className="h-full w-full text-brand-on-primary" />
              </div>
              <span className="font-serif text-lg font-semibold tracking-tight">PetitionHQ</span>
            </Link>
            <nav className="flex items-center gap-2 text-sm text-text-secondary sm:gap-3" aria-label="Primary">
              <ThemeToggle />
              <MobileMenu links={mobileLinks} />
              {!forcePublicNav && session?.role === "admin" && !isAdminPage && (
                <div className="hidden md:flex items-center gap-5">
                  <Link href="/admin" className="hover:text-text-primary">Dashboard</Link>
                  <Link href="/cases" className="hover:text-text-primary">Cases</Link>
                  <Link href="/admin/leads" className="hover:text-text-primary">Leads</Link>
                  <Link href="/admin/users" className="hover:text-text-primary">Users</Link>
                </div>
              )}
              {!forcePublicNav && session?.role === "attorney" && !session?.guestCaseId && !isNetworkPage && (
                <div className="hidden md:flex items-center gap-5">
                  <Link href="/network/dashboard" className="hover:text-text-primary">Dashboard</Link>
                  <Link href="/network/leads" className="hover:text-text-primary">Network</Link>
                  <Link href="/cases" className="hover:text-text-primary">My cases</Link>
                  <Link href="/network/billing" className="hover:text-text-primary">Billing</Link>
                </div>
              )}
              {!forcePublicNav && session?.role === "applicant" && !session?.guestCaseId && (
                <Link href="/cases" className="hover:text-text-primary">My case</Link>
              )}
              {(forcePublicNav || !session) && (
                <>
                  <div className="hidden md:flex items-center gap-5 mr-2">
                    <Link href="/eb2-niw-guide" className="hover:text-text-primary">EB-2 NIW guide</Link>
                    <Link href="/how-it-works" className="hover:text-text-primary">How it works</Link>
                    <Link href="/for-attorneys" className="hover:text-text-primary">For attorneys</Link>
                    <Link href="/faq" className="hover:text-text-primary">FAQ</Link>
                  </div>
                  <Link
                    href="/login"
                    className="inline-block rounded-full border border-border-default px-3 py-1.5 text-xs font-semibold text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/check"
                    className="rounded-full bg-brand-primary px-3 py-1.5 text-xs font-semibold text-brand-on-primary hover:bg-brand-primary-hover transition-colors sm:px-4"
                  >
                    Check eligibility
                  </Link>
                </>
              )}
              {session && !forcePublicNav && (
                <>
                  {!session.guestCaseId && !isNetworkPage && (
                    <Link href="/profile" className="hidden md:inline hover:text-text-primary">Profile</Link>
                  )}
                  <div className="flex items-center gap-2 border-l border-border-default pl-2 sm:gap-3 sm:pl-4">
                    <span className="hidden sm:inline text-text-muted truncate max-w-[120px]">
                      {session.name}
                    </span>
                    <span className={`badge badge-role-${session.role}`}>
                      {session.role === "applicant" ? "Applicant" : session.role}
                    </span>
                    <LogoutButton />
                  </div>
                </>
              )}
            </nav>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-content px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="mt-20 border-t border-border-default bg-surface-card py-10 text-sm text-text-secondary">
          <div className="mx-auto grid max-w-content gap-8 px-4 sm:grid-cols-2 sm:px-6 md:grid-cols-4">
            <div>
              <p className="font-serif text-base text-text-primary">PetitionHQ</p>
              <p className="mt-2 text-xs text-text-muted">
                The smartest way to build your U.S. immigration petition.
              </p>
            </div>
            <div>
              <p className="font-semibold text-text-primary">Product</p>
              <ul className="mt-2 space-y-1">
                <li><Link href="/check" className="hover:text-text-primary">Free eligibility check</Link></li>
                <li><Link href="/how-it-works" className="hover:text-text-primary">How it works</Link></li>
                <li><Link href="/for-attorneys" className="hover:text-text-primary">For attorneys</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary">Resources</p>
              <ul className="mt-2 space-y-1">
                <li><Link href="/articles" className="hover:text-text-primary">Articles</Link></li>
                <li><Link href="/eb2-niw-guide" className="hover:text-text-primary">EB-2 NIW guide</Link></li>
                <li><Link href="/eb2-niw-vs-eb1a" className="hover:text-text-primary">EB-2 NIW vs EB-1A</Link></li>
                <li><Link href="/eb2-niw-processing-time" className="hover:text-text-primary">NIW processing time</Link></li>
                <li><Link href="/visa-categories" className="hover:text-text-primary">Visa categories</Link></li>
                <li><Link href="/faq" className="hover:text-text-primary">FAQ</Link></li>
                <li><Link href="/about" className="hover:text-text-primary">About</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-text-primary">Contact</p>
              <ul className="mt-2 space-y-1">
                <li><a href="mailto:hello@petitionhq.us" className="hover:text-text-primary">hello@petitionhq.us</a></li>
                <li><a href="mailto:support@petitionhq.us" className="hover:text-text-primary">support@petitionhq.us</a></li>
                <li><a href="mailto:privacy@petitionhq.us" className="hover:text-text-primary">privacy@petitionhq.us</a></li>
              </ul>
            </div>
          </div>
          <div className="mx-auto mt-8 max-w-content px-4 text-center text-xs text-text-muted sm:px-6">
            <p>© {new Date().getFullYear()} PetitionHQ. Document preparation software — not legal advice.</p>
            <p className="mt-1">
              <Link href="/privacy" className="hover:text-text-secondary">Privacy</Link>
              {" · "}
              <Link href="/terms" className="hover:text-text-secondary">Terms</Link>
              {" · "}
              <Link href="/sitemap.xml" className="hover:text-text-secondary">Sitemap</Link>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
