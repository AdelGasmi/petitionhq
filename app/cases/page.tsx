import Link from "next/link";
import { redirect } from "next/navigation";
import { listCases } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { getForm } from "@/forms";
import { CasesListAdmin } from "@/components/CasesListAdmin";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.guestCaseId) redirect(`/cases/${session.guestCaseId}`);

  // Applicants have exactly one case — go straight to it
  if (session.role === "applicant") {
    const cases = await listCases({ role: "applicant", userId: session.userId });
    if (cases.length > 0) redirect(`/cases/${cases[0].id}`);
    redirect("/profile");
  }

  const cases = await listCases({ role: session.role, userId: session.userId });
  const isAttorney = session.role === "attorney";
  const isAdmin    = session.role === "admin";

  const attorneys = isAdmin
    ? (await listUsers()).filter((u) => u.role === "attorney").map((u) => ({ id: u.id, name: u.name }))
    : [];

  const forms = Object.fromEntries(cases.map((c) => [c.formId, getForm(c.formId)]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl tracking-tight">
          {isAdmin ? "All cases" : "My cases"}
        </h1>
        {isAdmin && (
          <Link href="/cases/new" className="btn btn-primary">New case</Link>
        )}
      </div>

      {cases.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">
            {isAttorney ? "No cases assigned to you yet." : "No cases yet."}
          </p>
          <p className="empty-state-body">
            {isAttorney ? (
              <Link href="/network/leads" className="underline hover:text-text-primary">
                Browse available leads →
              </Link>
            ) : (
              <Link href="/cases/new" className="underline hover:text-text-primary">
                Create your first case →
              </Link>
            )}
          </p>
        </div>
      ) : isAdmin ? (
        <CasesListAdmin cases={cases} forms={forms} attorneys={attorneys} />
      ) : (
        <div className="cards-enter space-y-4">
          {cases.map((c) => {
            const form = getForm(c.formId);
            return (
              <div key={c.id} className="card space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={`/cases/${c.id}`} className="font-serif text-lg tracking-tight hover:underline">
                      {c.title}
                    </Link>
                    <div className="mt-1 text-sm text-text-secondary">
                      {form?.shortTitle ?? c.formId}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {isAttorney && c.reviewStatus === "pending" && (
                      <div className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
                        review pending
                      </div>
                    )}
                    <Link href={`/cases/${c.id}`} className="text-xs text-text-muted hover:text-text-primary underline">
                      Open case →
                    </Link>
                  </div>
                </div>
                {isAttorney && (
                  <div className="text-xs text-text-muted">
                    Updated {new Date(c.updatedAt).toLocaleString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
