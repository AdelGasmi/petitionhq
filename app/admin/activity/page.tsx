import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { listActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  "case.created":          { label: "Case created",         color: "bg-success-soft text-success-text" },
  "case.deleted":          { label: "Case deleted",         color: "bg-danger-soft text-danger-text" },
  "case.status_changed":   { label: "Status changed",       color: "bg-info-soft text-info-text" },
  "case.attorney_assigned":{ label: "Attorney assigned",    color: "bg-info-soft text-info-text" },
  "case.attorney_removed": { label: "Attorney removed",     color: "bg-surface-muted text-text-secondary" },
  "case.review_requested": { label: "Review requested",     color: "bg-warning-soft text-warning-text" },
  "case.review_responded": { label: "Review responded",     color: "bg-warning-soft text-warning-text" },
  "letter.drafted":        { label: "Letter drafted",       color: "bg-info-soft text-info-text" },
  "letter.deleted":        { label: "Letter deleted",       color: "bg-danger-soft text-danger-text" },
  "letter.review_sent":    { label: "Review invite sent",   color: "bg-info-soft text-info-text" },
  "letter.review_submitted":{ label: "Recommender submitted",color: "bg-success-soft text-success-text" },
  "document.uploaded":     { label: "Document uploaded",    color: "bg-info-soft text-info-text" },
  "document.deleted":      { label: "Document deleted",     color: "bg-danger-soft text-danger-text" },
  "message.sent":          { label: "Message sent",         color: "bg-surface-muted text-text-secondary" },
  "user.created":          { label: "User created",         color: "bg-success-soft text-success-text" },
  "user.updated":          { label: "User updated",         color: "bg-info-soft text-info-text" },
  "user.deleted":          { label: "User deleted",         color: "bg-danger-soft text-danger-text" },
  "lead.consented":        { label: "Lead consented",       color: "bg-success-soft text-success-text" },
  "lead.claimed":          { label: "Lead claimed",         color: "bg-info-soft text-info-text" },
  "lead.result_viewed":    { label: "Result viewed",        color: "bg-surface-muted text-text-secondary" },
  "lead.email_submitted":  { label: "Email submitted",      color: "bg-info-soft text-info-text" },
  "lead.delivered":        { label: "Lead delivered",       color: "bg-success-soft text-success-text" },
  "lead.disqualified":     { label: "Lead disqualified",    color: "bg-danger-soft text-danger-text" },
  "intake.started":        { label: "Intake started",       color: "bg-info-soft text-info-text" },
  "intake.completed":      { label: "Intake completed",     color: "bg-success-soft text-success-text" },
  "dossier.generated":     { label: "Dossier generated",    color: "bg-info-soft text-info-text" },
};

// Humanize any event key not explicitly mapped above, so the log never shows a
// raw "lead.result_viewed" style token.
function humanizeAction(action: string): string {
  const s = action.replace(/[._]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : action;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function ActivityPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/cases");

  const entries = await listActivity(200);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl tracking-tight">Activity log</h1>
          <p className="mt-1 text-sm text-text-muted">Last 200 events across all cases</p>
        </div>
        <Link href="/admin" className="btn btn-secondary">Dashboard</Link>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state"><p className="empty-state-title">No activity yet</p></div>
      ) : (
        <div className="card divide-y divide-border-subtle p-0 overflow-hidden">
          {entries.map((e) => {
            const meta = ACTION_LABELS[e.action] ?? { label: humanizeAction(e.action), color: "bg-surface-muted text-text-secondary" };
            return (
              <div key={e.id} className="flex items-start gap-4 px-5 py-3">
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    {e.actorName && (
                      <span className="text-sm font-medium text-text-primary">{e.actorName}</span>
                    )}
                    {e.actorRole && (
                      <span className="text-xs text-text-muted">{e.actorRole}</span>
                    )}
                    {e.caseTitle && e.caseId && (
                      <>
                        <span className="text-xs text-text-muted">on</span>
                        <Link
                          href={`/cases/${e.caseId}`}
                          className="truncate text-sm text-text-secondary hover:text-text-primary hover:underline"
                        >
                          {e.caseTitle}
                        </Link>
                      </>
                    )}
                    {e.detail && (
                      <span className="text-xs text-text-muted">{e.detail}</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-text-muted" title={e.createdAt}>
                  {timeAgo(e.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
