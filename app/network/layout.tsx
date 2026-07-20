import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attorneyTermsCurrent } from "@/lib/attorneyTerms";
import { AttorneyTermsGate } from "@/components/network/AttorneyTermsGate";
import { AttorneyTermsContent } from "@/components/network/AttorneyTermsContent";

const NAV_ITEMS = [
  { href: "/network/dashboard", label: "Dashboard" },
  { href: "/network/leads",     label: "Leads" },
  { href: "/cases",             label: "My cases" },
  { href: "/network/billing",   label: "Billing" },
  { href: "/network/rules",     label: "Rules" },
];

export default async function NetworkLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    redirect("/login?from=/network/dashboard");
  }

  // Attorney platform-terms gate (server-enforced): attorneys must accept the
  // current ATTORNEY_TERMS_VERSION before any /network surface renders.
  // Claim + claim-ledger routes re-check independently (defense in depth).
  if (session.role === "attorney") {
    const u = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { attorneyTermsAcceptedAt: true, attorneyTermsVersion: true },
    });
    if (!u || !attorneyTermsCurrent(u)) {
      return (
        <div className="py-10">
          <AttorneyTermsGate>
            <AttorneyTermsContent />
          </AttorneyTermsGate>
        </div>
      );
    }
  }

  const firm = session.role === "attorney"
    ? await prisma.firmProfile.findUnique({
        where: { userId: session.userId },
        select: { firmName: true },
      })
    : null;

  const displayName = firm?.firmName ?? session.name;

  return (
    <div className="min-h-screen">
      {/* Sticky attorney sub-nav — mirrors admin shell pattern */}
      <nav
        className="sticky top-0 z-30 border-b border-border-default bg-surface-card"
        aria-label="Attorney navigation"
      >
        {/* Wraps on small screens so every link stays visible (was a hidden-
            scrollbar horizontal scroll that cut off Billing/Rules/Profile on mobile). */}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 py-2">
          {/* Firm / identity badge */}
          <span className="mr-1 shrink-0 text-xs font-semibold text-text-muted truncate max-w-[140px]">
            {displayName}
          </span>
          <span className={`badge badge-role-${session.role} mr-2 shrink-0`}>
            {session.role}
          </span>
          {NAV_ITEMS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              {label}
            </Link>
          ))}
          <Link
            href="/profile"
            className="ml-auto shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Profile
          </Link>
        </div>
      </nav>

      {/* Page content */}
      <div className="py-6">
        {children}
      </div>
    </div>
  );
}
