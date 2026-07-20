import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/cases", label: "Cases" },
  { href: "/admin/funnel", label: "Funnel" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/firms", label: "Firms" },
  { href: "/admin/refunds", label: "Refunds" },
  { href: "/admin/activity", label: "Activity" },
  { href: "/admin/email-log", label: "Email log" },
  { href: "/admin/pilot", label: "Pilot" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  return (
    <div className="min-h-screen">
      {/* Sticky top nav rail */}
      <nav className="sticky top-0 z-40 border-b border-border-default bg-surface-card">
        <div className="mx-auto max-w-screen-2xl px-4">
          {/* Wraps on small screens so all 10 sections stay reachable (was a
              hidden-scrollbar horizontal scroll that cut off later tabs on mobile). */}
          <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 py-2">
            <span className="mr-2 shrink-0 text-xs font-semibold uppercase tracking-widest text-text-muted">
              Admin
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
          </div>
        </div>
      </nav>

      {/* Page content */}
      <div className="mx-auto max-w-screen-2xl px-4 py-6">
        {children}
      </div>
    </div>
  );
}
