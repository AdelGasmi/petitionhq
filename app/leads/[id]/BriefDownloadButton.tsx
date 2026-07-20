"use client";

import { useState } from "react";

type LintIssue = { section: string; line: string; reason: string; severity: string };

/**
 * Brief (.docx) download with the GAP-4 provenance gate baked in.
 *
 * A plain <a> anchor would dump the route's 422 JSON into the browser. Instead
 * we fetch the brief: on 200 we stream the docx to a download; on 422 we surface
 * the flagged claims and offer an explicit, audit-logged "Export anyway" override
 * (which re-requests with ?ack=1). The dossier PDF stays a plain link — only the
 * filing work product is gated.
 */
export function BriefDownloadButton({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState<{ message: string; issues: LintIssue[] } | null>(null);

  const download = async (ack: boolean) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/leads/${leadId}/brief${ack ? "?ack=1" : ""}`);

      if (res.status === 422) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string; issues?: LintIssue[] }
          | null;
        setBlocked({
          message: data?.message ?? "This brief contains unverified claims.",
          issues: Array.isArray(data?.issues) ? data!.issues! : [],
        });
        setLoading(false);
        return;
      }
      if (!res.ok) {
        setError("Could not generate the brief. Please try again.");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const m = cd.match(/filename="([^"]+)"/);
      const filename = m?.[1] ?? `petition-brief-${leadId.slice(0, 8)}.docx`;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
      setBlocked(null);
      setLoading(false);
    } catch {
      setError("Network error — please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => download(false)}
        disabled={loading}
        className="btn btn-secondary text-sm"
      >
        {loading ? "Preparing…" : "Download brief (.docx)"}
      </button>
      {error && <p className="text-xs text-danger-fill text-right max-w-48">{error}</p>}
      {blocked && (
        <div className="mt-1 w-72 rounded-lg border border-warning-border bg-warning-bg p-3 text-left">
          <p className="text-xs font-semibold text-warning-text">Unverified claims detected</p>
          <p className="mt-1 text-xs text-warning-text">{blocked.message}</p>
          {blocked.issues.length > 0 && (
            <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px] text-warning-text">
              {blocked.issues.slice(0, 6).map((it, i) => (
                <li key={i}>
                  • <span className="font-medium">{it.section}</span>: {it.reason}
                </li>
              ))}
              {blocked.issues.length > 6 && (
                <li>…and {blocked.issues.length - 6} more.</li>
              )}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-warning-text">
            Exporting anyway is recorded to the case activity log.
          </p>
          <div className="mt-2 flex justify-end gap-3">
            <button
              onClick={() => setBlocked(null)}
              className="text-xs text-text-secondary hover:underline"
            >
              Cancel
            </button>
            <button
              onClick={() => download(true)}
              disabled={loading}
              className="btn btn-secondary text-xs py-1"
            >
              Export anyway
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
