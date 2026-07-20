import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { RefundActions } from "./RefundActions";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, string> = {
  pending: "badge badge-warning",
  approved: "badge badge-success",
  denied: "badge badge-danger",
  refunded: "badge badge-success",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  denied: "Denied",
  refunded: "Refunded",
};

const REASON_LABEL: Record<string, string> = {
  material_misrepresentation: "Material misrepresentation",
  applicant_ghost: "Applicant unresponsive",
  other: "Other",
};

export default async function AdminRefundsPage() {
  const refundRequests = await prisma.refundRequest.findMany({
    orderBy: [
      { status: "asc" }, // pending first
      { createdAt: "desc" },
    ],
    include: {
      attorney: { select: { id: true, name: true, email: true } },
      case: { select: { id: true, title: true } },
      decidedBy: { select: { name: true } },
    },
  });

  const pendingCount = refundRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl tracking-tight">Refund Requests</h1>
          <p className="mt-1 text-sm text-text-muted">
            {pendingCount > 0
              ? `${pendingCount} pending request${pendingCount > 1 ? "s" : ""}`
              : "No pending requests"}
          </p>
        </div>
        <Link href="/admin" className="btn btn-ghost text-sm">
          ← Dashboard
        </Link>
      </div>

      {refundRequests.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-title">No refund requests</p>
          <p className="empty-state-body">Refund requests from attorneys will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {refundRequests.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl border bg-surface-card px-6 py-5 space-y-3 ${
                r.status === "pending"
                  ? "border-warning-border bg-warning-bg/30"
                  : "border-border-default"
              }`}
            >
              {/* Top row: status + case + attorney */}
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={STATUS_BADGE[r.status] ?? "badge badge-neutral"}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                    <span className="text-xs text-text-muted">
                      {new Date(r.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-text-primary">
                    {REASON_LABEL[r.reason] ?? r.reason}
                  </p>
                </div>
                <div className="text-right text-xs text-text-muted shrink-0">
                  <p>
                    Case:{" "}
                    <Link
                      href={`/leads/${r.caseId}`}
                      className="underline hover:text-text-secondary"
                    >
                      {r.case.title || r.caseId.slice(0, 8)}
                    </Link>
                  </p>
                  <p>Attorney: {r.attorney.name ?? r.attorney.email}</p>
                </div>
              </div>

              {/* Explanation */}
              <div className="rounded-lg border border-border-subtle bg-surface-subtle px-4 py-3">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
                  Explanation
                </p>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                  {r.explanation}
                </p>
              </div>

              {/* Decision info for resolved requests */}
              {r.decidedAt && (
                <div className="text-xs text-text-muted">
                  {r.status === "refunded" && r.stripeRefundId && (
                    <span className="mr-3">Stripe: {r.stripeRefundId}</span>
                  )}
                  Decided by {r.decidedBy?.name ?? "admin"} on{" "}
                  {new Date(r.decidedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {r.decisionNotes && (
                    <span className="ml-2 text-text-muted">— {r.decisionNotes}</span>
                  )}
                </div>
              )}

              {/* Action buttons for pending requests */}
              {r.status === "pending" && (
                <RefundActions refundId={r.id} caseId={r.caseId} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
