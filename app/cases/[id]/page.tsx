import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { readCase, findCompanionCases } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getForm } from "@/forms";
import { findUserById } from "@/lib/users";
import { CaseWorkspace } from "@/components/CaseWorkspace";
import { AttorneyPanel } from "@/components/AttorneyPanel";
import { ReviewRequestPanel } from "@/components/ReviewRequestPanel";
import { AdminNotes } from "@/components/AdminNotes";
import { PaymentBadge } from "@/components/PaymentBadge";
import { GuestLinkPanel } from "@/components/GuestLinkPanel";
import { CaseTimeline } from "@/components/CaseTimeline";
import { FollowUpPanel } from "@/components/FollowUpPanel";
import { canManageCase } from "@/lib/auth";
import { BetaAgreementGate } from "@/components/case/BetaAgreementGate";
import { BetaBanner } from "@/components/case/BetaBanner";

export const dynamic = "force-dynamic";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [c, session] = await Promise.all([readCase(id), getSession()]);
  if (!c) notFound();
  if (!session) redirect("/login");

  if (!canManageCase(session, c)) redirect("/cases");

  const form = getForm(c.formId);
  if (!form) notFound();

  // Self-petitioner beta: gate everything on the agreement before any case
  // content loads (server-enforced, not just UI). See beta_onboarding_plan.md §3.
  const currentUser = session.role === "applicant" ? await findUserById(session.userId) : null;
  const isBetaUser = !!currentUser?.selfPetitionerBeta;
  if (isBetaUser && !currentUser!.betaAgreementAcceptedAt) {
    return (
      <div className="py-10">
        <BetaAgreementGate />
      </div>
    );
  }

  const assignedAttorney = c.attorneyId ? await findUserById(c.attorneyId) : null;

  // Companion filings for I-485 cases. No per-applicant case limit anymore
  // (Pricing-V2 — applicants are free).
  const COMPANION_FORM_IDS = ["i765", "i131"];
  const isAos = c.formId === "i485";
  const ownerId = c.ownerId ?? session.userId;

  const existingCompanions = isAos
    ? await findCompanionCases(ownerId, COMPANION_FORM_IDS)
    : [];

  const companionCases = isAos
    ? COMPANION_FORM_IDS.map((formId) => ({
        formId,
        caseId: existingCompanions.find((e) => e.formId === formId)?.id ?? null,
      }))
    : undefined;
  const canCreateMore = true;

  // Official-form PDF auto-fill is attorney tooling only (UPL guard,
  // 2026-07-05): self-petitioners must never receive filled government forms.
  // Route enforces this server-side too (app/api/cases/[id]/pdf).
  const canDownloadPdf = session.role === "attorney" && !session.guestCaseId;

  const isGuest = !!session.guestCaseId;
  // canManageCase already confirmed attorney-on-case / owner-applicant above,
  // so drafting access only turns on whether this applicant is beta-flagged.
  const canDraft = session.role === "attorney" || isBetaUser;

  return (
    <div className="space-y-8">
      {isBetaUser && <BetaBanner />}
      {isGuest ? (
        <div className="rounded-lg border border-border-default bg-surface-subtle px-4 py-3 text-sm text-text-secondary">
          <span className="font-medium">Guest access.</span> You have read-only access to this case for review purposes. Use the messages tab to leave feedback. Your link is valid for 14 days.
        </div>
      ) : session.role !== "applicant" && (
        <div>
          <Link href="/cases" className="text-sm text-text-muted hover:text-text-primary">
            ← Cases
          </Link>
        </div>
      )}

      <header className="flex items-start justify-between gap-6">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-text-muted">
            Form {form.formNumber} • {form.shortTitle}
          </div>
          <h1 className="mt-1 font-serif text-3xl tracking-tight">{c.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-text-secondary">
            {c.status}
          </span>
          {session.role === "admin" && (
            <PaymentBadge
              caseId={c.id}
              initialStatus={c.paymentStatus}
              initialNotes={c.paymentNotes}
            />
          )}
        </div>
      </header>

      {/* Self-petitioner beta: the assigned "attorney" is the founder's concierge
          account, not a real reviewer — never surface it as one (beta doc §4.3). */}
      {!isGuest && !isBetaUser && (
        <>
          <AttorneyPanel
            caseId={c.id}
            currentUserId={session.userId}
            currentUserRole={session.role}
            assignedAttorneyId={c.attorneyId}
            assignedAttorneyName={assignedAttorney?.name}
          />

          <ReviewRequestPanel
            caseId={c.id}
            reviewStatus={c.reviewStatus}
            reviewNote={c.reviewNote}
            currentUserRole={session.role}
            hasAttorney={!!c.attorneyId}
          />
        </>
      )}

      {session.role === "attorney" && !isGuest && (
        <GuestLinkPanel caseId={c.id} />
      )}

      {/* Attorney: timeline + follow-up scheduling */}
      {session.role === "attorney" && !isGuest && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CaseTimeline caseData={c} />
          <FollowUpPanel
            caseId={c.id}
            initialFollowUp={c.nextFollowUp}
            initialAction={c.nextAction}
          />
        </div>
      )}

      {session.role === "admin" ? (
        <>
          <div className="card">
            <AdminNotes caseId={c.id} />
          </div>
          <div className="rounded-xl border border-border-default bg-surface-subtle px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-muted">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <p className="font-medium text-text-secondary">Case content is private</p>
            <p className="mt-1 text-sm text-text-muted">
              Form answers, documents, letters, and messages are only visible to the client and their attorney.
            </p>
          </div>
        </>
      ) : (
        <CaseWorkspace
          initialCase={c}
          form={form}
          currentUserId={session.userId}
          currentUserRole={session.role}
          isGuest={isGuest}
          companionCases={companionCases}
          canCreateMore={canCreateMore}
          canDownloadPdf={canDownloadPdf}
          canDraft={canDraft}
        />
      )}
    </div>
  );
}
