import Link from "next/link";
import { redirect } from "next/navigation";
import { listCases } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { listUsers } from "@/lib/users";
import { PaymentBadge } from "@/components/PaymentBadge";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft:  "bg-surface-muted text-text-secondary",
  review: "bg-info-soft text-info-text",
  ready:  "bg-success-soft text-success-text",
  filed:  "bg-surface-muted text-text-muted",
};

export default async function ClientsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  const [allCases, users] = await Promise.all([
    listCases({ role: "admin" }),
    listUsers(),
  ]);

  const applicants = users.filter((u) => u.role === "applicant");
  const applicantMap = Object.fromEntries(applicants.map((u) => [u.id, u]));

  // Group cases by owner
  const byClient: Record<string, typeof allCases> = {};
  for (const c of allCases) {
    const key = c.ownerId ?? "__none__";
    if (!byClient[key]) byClient[key] = [];
    byClient[key].push(c);
  }

  // Sort clients: those with cases first, then alphabetically
  const clientEntries = Object.entries(byClient).sort(([aId], [bId]) => {
    const aName = applicantMap[aId]?.name ?? "";
    const bName = applicantMap[bId]?.name ?? "";
    return aName.localeCompare(bName);
  });

  // Payment summary counts
  const unpaidCount = allCases.filter((c) => c.paymentStatus === "unpaid").length;
  const invoicedCount = allCases.filter((c) => c.paymentStatus === "invoiced").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Cases</h1>
          <p className="mt-1 text-sm text-text-muted">
            {allCases.length} case{allCases.length !== 1 ? "s" : ""} · {clientEntries.length} client{clientEntries.length !== 1 ? "s" : ""}
            {unpaidCount > 0 && (
              <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-text">
                {unpaidCount} unpaid
              </span>
            )}
            {invoicedCount > 0 && (
              <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-text">
                {invoicedCount} invoiced
              </span>
            )}
          </p>
        </div>
        <Link href="/admin/users" className="btn btn-secondary">Manage users</Link>
      </div>

      {clientEntries.length === 0 ? (
        <div className="empty-state"><p className="empty-state-title">No clients yet</p></div>
      ) : (
        <div className="space-y-8">
          {clientEntries.map(([ownerId, cases]) => {
            const client = applicantMap[ownerId];
            const clientName = client?.name ?? (ownerId === "__none__" ? "No client" : "Unknown");
            const paidCount = cases.filter((c) => c.paymentStatus === "paid").length;

            return (
              <div key={ownerId} className="card space-y-4 p-0 overflow-hidden">
                {/* Client header — PII redacted for admin zero-trust */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border-subtle">
                  <div>
                    <div className="font-medium text-text-primary">
                      Client #{ownerId === "__none__" ? "unassigned" : ownerId.slice(0, 8)}
                    </div>
                    <div className="text-xs text-text-muted italic">PII redacted</div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span>{cases.length} case{cases.length !== 1 ? "s" : ""}</span>
                    {paidCount > 0 && paidCount === cases.length && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 font-medium text-success-text">
                        all paid
                      </span>
                    )}
                  </div>
                </div>

                {/* Cases */}
                {/* Case rows — metadata only, no workspace links */}
                <div className="divide-y divide-border-subtle">
                  {cases.map((c) => (
                    <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-text-primary">
                          Case #{c.id.slice(0, 8)} · {c.formId}
                        </div>
                        <div className="text-xs text-text-muted">
                          Updated {new Date(c.updatedAt).toLocaleDateString()}
                          {c.attorneyId && (
                            <> · attorney assigned</>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[c.status] ?? "bg-surface-muted text-text-secondary"}`}>
                          {c.status}
                        </span>
                        <PaymentBadge
                          caseId={c.id}
                          initialStatus={c.paymentStatus}
                          initialNotes={c.paymentNotes}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
