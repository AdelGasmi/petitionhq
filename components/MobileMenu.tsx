"use client";

import Link from "next/link";
import { useState } from "react";

export type MobileMenuLink = { href: string; label: string };

/**
 * Mobile-only nav menu (hamburger) for the global header. The desktop header
 * nav is `hidden md:flex`, so without this there was no way to reach
 * Dashboard / Billing / Profile etc. on a phone (esp. on non-/network pages
 * like /cases that have no secondary sub-nav). Shown only below md.
 */
export function MobileMenu({ links }: { links: MobileMenuLink[] }) {
  const [open, setOpen] = useState(false);
  if (links.length === 0) return null;

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></> : <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>}
        </svg>
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <nav
            className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-lg border border-border-default bg-surface-card py-1 shadow-lg"
            aria-label="Mobile navigation"
          >
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              >
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}
    </div>
  );
}
