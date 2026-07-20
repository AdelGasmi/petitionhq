"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Spinner, Check } from "@/components/icons";

type CompanionCase = { formId: string; caseId: string | null };

const COMPANION_META: Record<string, { label: string; shortLabel: string; icon: string; warning: string }> = {
  i765: {
    label: "Employment Authorization (EAD)",
    shortLabel: "EAD",
    icon: "💳",
    warning: "You need an EAD to legally work in the US while your I-485 is pending.",
  },
  i131: {
    label: "Advance Parole / Travel Document",
    shortLabel: "Advance Parole",
    icon: "✈️",
    warning: "Do NOT travel internationally without Advance Parole in hand — it will abandon your I-485.",
  },
};

export function PdfDownloadButton({ caseId, canDownload }: { caseId: string; canDownload: boolean }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    if (!canDownload) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/pdf`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error ?? "PDF generation failed.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("content-disposition") ?? "";
      const m = cd.match(/filename="([^"]+)"/);
      a.download = m?.[1] ?? "form-prefilled.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  if (!canDownload) {
    return (
      <a
        href="/profile"
        className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-subtle px-3 py-1.5 text-xs text-text-muted hover:bg-surface-muted"
        title="Upgrade to Professional to download pre-filled PDF"
      >
        <Download className="h-3.5 w-3.5" />
        Pre-filled PDF
        <span className="ml-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-warning-text">Pro</span>
      </a>
    );
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface-card px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-subtle disabled:opacity-50"
    >
      {loading ? (
        <Spinner className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {loading ? "Generating…" : "Download pre-filled PDF"}
    </button>
  );
}

export function CompanionFilingBanner({
  companions,
  canCreate,
}: {
  companions: CompanionCase[];
  canCreate: boolean;
}) {
  return (
    <div className="rounded-xl border border-warning-border bg-warning-bg p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-warning-text mb-3">
        Companion filings — file these with your I-485
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {companions.map(({ formId, caseId }) => {
          const meta = COMPANION_META[formId];
          if (!meta) return null;
          return (
            <div
              key={formId}
              className={`rounded-lg border bg-surface-card p-3 ${
                caseId ? "border-success-border" : "border-warning-border"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-xl">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-text-primary">{meta.label}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{meta.warning}</p>
                </div>
              </div>
              <div className="mt-3">
                {caseId ? (
                  <a
                    href={`/cases/${caseId}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-success-soft px-3 py-1.5 text-xs font-medium text-success-text hover:bg-success-border"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Case open — view {meta.shortLabel}
                  </a>
                ) : canCreate ? (
                  <Link
                    href={`/cases/new?formId=${formId}`}
                    className="inline-flex items-center gap-1 rounded-lg bg-warning-text px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                  >
                    + Start {meta.shortLabel} case
                  </Link>
                ) : (
                  <Link
                    href="/cases/new"
                    className="inline-flex items-center gap-1 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-subtle"
                  >
                    Upgrade plan to add
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-warning-text">
        These are separate USCIS forms but are filed together with I-485 — ideally on the same day. EAD and Advance Parole are free when filed concurrently.
      </p>
    </div>
  );
}
