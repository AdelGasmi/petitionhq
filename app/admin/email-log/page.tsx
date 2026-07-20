import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listEmailLog } from "@/lib/email";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  "letter":        "Letter PDF",
  "review-invite": "Review invite",
  "user-invite":   "User invite",
  "verification":  "Verification PIN",
  "notification":  "Notification",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function EmailLogPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  const entries = await listEmailLog(200);
  const failed  = entries.filter((e) => e.status === "failed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Email log</h1>
          <p className="mt-1 text-sm text-text-muted">
            Last 200 emails sent through the platform
            {failed > 0 && (
              <span className="ml-2 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger-text">
                {failed} failed
              </span>
            )}
          </p>
        </div>
        <Link href="/admin" className="btn btn-secondary">Dashboard</Link>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state"><p className="empty-state-title">No emails sent yet</p></div>
      ) : (
        <div className="card divide-y divide-border-subtle overflow-hidden p-0">
          {entries.map((e) => (
            <div key={e.id} className="flex items-start gap-4 px-5 py-3">
              {/* Status dot */}
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.status === "sent" ? "bg-success-fill" : "bg-danger-fill"}`} />

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-text-primary truncate">{e.subject}</span>
                  <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted">
                    {KIND_LABEL[e.kind] ?? e.kind}
                  </span>
                </div>
                <div className="text-xs text-text-muted">
                  To: <span className="text-text-secondary">{e.to}</span>
                  {e.actorName && <> · by {e.actorName}</>}
                  {e.caseTitle && e.caseId && (
                    <> · <Link href={`/cases/${e.caseId}`} className="hover:underline">{e.caseTitle}</Link></>
                  )}
                </div>
                {e.error && (
                  <div className="text-xs text-danger-fill">{e.error}</div>
                )}
              </div>

              <span className="shrink-0 text-xs text-text-muted" title={e.createdAt}>
                {timeAgo(e.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
