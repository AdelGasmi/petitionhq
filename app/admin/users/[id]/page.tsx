import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { findPublicUserById } from "@/lib/users";
import { listCases } from "@/lib/db";
import { getForm } from "@/forms";
import { UserEditForm } from "@/components/UserEditForm";
import { ResendInviteButton } from "@/components/ResendInviteButton";
import { BetaAccessPanel } from "@/components/BetaAccessPanel";
import { betaCaseCostCents, BETA_CASE_COST_CAP_CENTS } from "@/lib/betaLimits";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft:  "bg-surface-muted text-text-secondary",
  review: "bg-info-soft text-info-text",
  ready:  "bg-success-soft text-success-text",
  filed:  "bg-surface-muted text-text-muted",
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  const { id } = await params;
  const user = await findPublicUserById(id);
  if (!user) notFound();

  const allCases = await listCases({ role: "admin" });
  const userCases = user.role === "attorney"
    ? allCases.filter((c) => c.attorneyId === id)
    : allCases.filter((c) => c.ownerId === id);

  const betaCostCents = user.selfPetitionerBeta && userCases[0]
    ? await betaCaseCostCents(userCases[0].id)
    : 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/users" className="text-sm text-text-muted hover:text-text-primary">
          ← Users
        </Link>
      </div>

      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">{user.name}</h1>
          <p className="mt-1 text-sm text-text-muted">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {user.pendingInvite && (
            <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-medium text-warning-text">
              invite pending
            </span>
          )}
          <span className={`badge badge-role-${user.role}`}>
            {user.role}
          </span>
        </div>
      </header>

      {user.pendingInvite && (
        <div className="rounded-lg border border-warning-border bg-warning-bg p-4 text-sm text-warning-text">
          <div className="font-medium">Account not yet activated</div>
          <p className="mt-1 text-warning-text">
            This user hasn&apos;t clicked their invite link yet. You can resend it below.
          </p>
          <div className="mt-3">
            <ResendInviteButton userId={user.id} email={user.email} name={user.name} />
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <UserEditForm user={{ id: user.id, name: user.name, email: user.email, role: user.role }} />

        <div className="card space-y-3 text-sm">
          <h2 className="font-serif text-lg">Account info</h2>
          <div className="space-y-2 text-text-secondary">
            <div className="flex justify-between">
              <span className="text-text-muted">User ID</span>
              <span className="font-mono text-xs">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Created</span>
              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Status</span>
              <span>{user.pendingInvite ? "Invite pending" : "Active"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Cases</span>
              <span>{userCases.length}</span>
            </div>
            {user.role === "attorney" && (
              <div className="flex justify-between">
                <span className="text-text-muted">Platform terms</span>
                <span>
                  {user.attorneyTermsAcceptedAt
                    ? `Accepted ${new Date(user.attorneyTermsAcceptedAt).toLocaleDateString()} (v${user.attorneyTermsVersion})`
                    : "Not accepted — gated at first /network visit"}
                </span>
              </div>
            )}
          </div>
        </div>

        {user.selfPetitionerBeta && (
          <BetaAccessPanel
            userId={user.id}
            agreementAcceptedAt={user.betaAgreementAcceptedAt}
            costCents={betaCostCents}
            capCents={BETA_CASE_COST_CAP_CENTS}
          />
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-xl tracking-tight">
          {user.role === "attorney" ? "Assigned cases" : "Cases"}
        </h2>
        {userCases.length === 0 ? (
          <p className="card text-sm text-text-muted">No cases yet.</p>
        ) : (
          <div className="space-y-2">
            {userCases.map((c) => {
              const form = getForm(c.formId);
              return (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="card card-hover flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-xs text-text-muted">
                      {form?.shortTitle ?? c.formId} · Updated {new Date(c.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? "bg-surface-muted text-text-secondary"}`}>
                    {c.status}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
