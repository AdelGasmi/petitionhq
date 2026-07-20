/**
 * /signup — invite-only
 *
 * Direct account creation is disabled. Accounts are created when an admin
 * sends an attorney invite. This page is kept so existing invite-token links
 * (e.g. /invite/[token]) can redirect here after setting a password.
 *
 * If someone lands here without a token, show them the gate message.
 */
import Link from "next/link";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm space-y-8 pt-24 px-4 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="1" width="13" height="17" rx="1.5" stroke="white" strokeWidth="1.5"/>
          <path d="M6 6h7M6 9h7M6 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="17" cy="16" r="4" fill="#1c1917" stroke="white" strokeWidth="1.5"/>
          <path d="M15 16l1.5 1.5L19 14" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className="space-y-3">
        <h1 className="font-serif text-3xl tracking-tight">Invite only</h1>
        <p className="text-text-muted text-sm leading-relaxed">
          petitionhq.us accounts are created by invitation.<br/>
          If you are an attorney, check your email for an invite link from your firm administrator.
        </p>
      </div>

      <div className="rounded-xl border border-border-default bg-surface-card px-6 py-6 space-y-4 text-left">
        <p className="text-sm font-medium text-text-secondary">Already have an account?</p>
        <Link
          href="/login"
          className="btn btn-primary w-full text-center block text-sm"
        >
          Sign in →
        </Link>
        <p className="text-xs text-text-muted text-center">
          Are you an applicant?{" "}
          <Link href="/check" className="underline hover:text-text-secondary">
            Check your NIW eligibility
          </Link>
        </p>
      </div>

      <p className="text-xs text-text-muted">
        Questions?{" "}
        <a href="mailto:support@petitionhq.us" className="underline hover:text-text-secondary">
          support@petitionhq.us
        </a>
      </p>
    </div>
  );
}
