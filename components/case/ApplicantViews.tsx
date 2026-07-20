"use client";

import { useState } from "react";
import type { Case, LetterRecord } from "@/lib/db";
import { buildExhibitRows } from "@/lib/exhibitPlan";
import { ExtractEvidencePanel } from "@/components/ExtractEvidencePanel";
import { Check, Users, ArrowRight } from "@/components/icons";
import { PetitionMark } from "@/components/icons/PetitionMark";
import { PdfDownloadButton } from "./CompanionBanner";

export function ApplicantStatusBanner({ c }: { c: Case }) {
  const formData = (c.formData ?? {}) as Record<string, unknown>;
  const q = (formData.qualifications ?? {}) as Record<string, unknown>;
  const e = (formData.endeavor ?? {}) as Record<string, unknown>;

  const hasProfile = !!(
    (q.publications as unknown[])?.length ||
    (q.awards as unknown[])?.length ||
    q.highestDegree
  );
  const hasEndeavor = !!(e.endeavorStatement as string)?.trim();
  const profileDone = hasProfile && hasEndeavor;
  const hasAttorney = !!c.attorneyId;
  const letterCount = Object.keys(c.letters ?? {}).length;
  const hasLetters = letterCount > 0;

  const steps = [
    { label: "Evidence profile", done: profileDone },
    { label: "Attorney matched", done: hasAttorney },
    { label: "Petition in progress", done: hasAttorney && hasLetters },
  ];

  const currentStep = steps.findIndex((s) => !s.done);
  const allDone = currentStep === -1;

  const nextAction = !profileDone
    ? { text: "Complete my evidence profile →", href: `/cases/${c.id}/intake` }
    : !hasAttorney
    ? { text: "Waiting to be matched with an attorney", href: null }
    : !hasLetters
    ? { text: "Your attorney is preparing your petition", href: null }
    : { text: "Petition in progress — your attorney will be in touch", href: null };

  return (
    <div className={`rounded-xl border px-5 py-4 ${allDone ? "border-success-border bg-success-bg" : "border-border-default bg-surface-subtle"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                s.done ? "bg-success-fill text-white" : i === currentStep ? "bg-surface-inverted text-white" : "bg-surface-muted text-text-muted"
              }`}>
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${s.done ? "text-success-text" : i === currentStep ? "text-text-primary" : "text-text-muted"}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-text-disabled ml-1" />}
            </div>
          ))}
        </div>
        {nextAction.href ? (
          <a href={nextAction.href} className="shrink-0 rounded-lg bg-brand-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-primary-hover transition-colors">
            {nextAction.text}
          </a>
        ) : (
          <span className="shrink-0 text-xs text-text-muted">{nextAction.text}</span>
        )}
      </div>
    </div>
  );
}

export function ApplicantRecommendersView({ letters }: { letters: Record<string, LetterRecord> }) {
  const recs = Object.values(letters)
    .filter((l) => l.recommender?.name)
    .map((l) => l.recommender);
  const independent = recs.filter((r) => r.kind !== "dependent");
  const dependent = recs.filter((r) => r.kind === "dependent");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-text-secondary">
          Your attorney selects recommenders after reviewing your profile. These are the people your attorney has chosen to write recommendation letters for your petition.
        </p>
      </div>

      {recs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border-default px-8 py-10 text-center space-y-3">
          <Users className="mx-auto h-10 w-10 text-text-disabled" />
          <p className="font-serif text-lg">No recommenders selected yet</p>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            Your attorney will review your profile and select recommenders for your petition. Check back once your attorney has started working on your case.
          </p>
        </div>
      ) : (
        <>
          {independent.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Independent recommenders ({independent.length})</h3>
              {independent.map((r, i) => <RecommenderCard key={i} rec={r} />)}
            </div>
          )}
          {dependent.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Dependent recommenders ({dependent.length})</h3>
              {dependent.map((r, i) => <RecommenderCard key={i} rec={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RecommenderCard({ rec }: { rec: { name: string; title?: string; institution?: string; credentials?: string; relationship?: string; email?: string; kind?: string } }) {
  return (
    <div className="card space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-primary">{rec.name || "(unnamed)"}</p>
        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted capitalize">{rec.kind ?? "independent"}</span>
      </div>
      {(rec.title || rec.institution) && (
        <p className="text-xs text-text-muted">{[rec.title, rec.institution].filter(Boolean).join(" — ")}</p>
      )}
      {rec.relationship && <p className="text-xs text-text-muted">{rec.relationship}</p>}
      {rec.email && <p className="text-xs text-text-muted">{rec.email}</p>}
    </div>
  );
}

export function ApplicantProfileView({ caseId, formData, onMerged, canDownloadPdf }: { caseId: string; formData: Record<string, unknown>; onMerged?: () => void; canDownloadPdf?: boolean }) {
  const q = (formData.qualifications ?? {}) as Record<string, unknown>;
  const e = (formData.endeavor ?? {}) as Record<string, unknown>;

  const pubs = (q.publications as Record<string, unknown>[] | undefined) ?? [];
  const awards = (q.awards as Record<string, unknown>[] | undefined) ?? [];
  const grants = (q.grants as Record<string, unknown>[] | undefined) ?? [];
  const roles = (q.editorialRoles as Record<string, unknown>[] | undefined) ?? [];
  const talks = (q.invitedTalks as Record<string, unknown>[] | undefined) ?? [];
  const totalCitations = pubs.reduce((sum, p) => sum + (typeof p.citations === "number" ? p.citations : 0), 0);

  const hasAnything = pubs.length || awards.length || grants.length || q.highestDegree || (e.endeavorStatement as string)?.trim();

  if (!hasAnything) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border-2 border-dashed border-border-default px-8 py-10 text-center space-y-4">
          <PetitionMark className="h-10 w-10 text-text-disabled mx-auto" />
          <div>
            <p className="font-serif text-lg">Your evidence profile is empty</p>
            <p className="mt-1 text-sm text-text-muted">
              Share your background, publications, and research goals so your attorney can build the strongest possible case. This takes 10–15 minutes and is the most important thing you can do right now.
            </p>
          </div>
          <a href={`/cases/${caseId}/intake`} className="inline-block rounded-lg bg-brand-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-hover transition-colors">
            Build my evidence profile →
          </a>
          <p className="text-xs text-text-muted">Takes about 10–15 minutes. No legal knowledge required.</p>
        </div>
        <div className="relative">
          <div className="absolute inset-x-0 top-1/2 border-t border-border-default" />
          <p className="relative z-10 text-center text-xs text-text-muted bg-surface-card w-fit mx-auto px-3">or import from your CV</p>
        </div>
        <ExtractEvidencePanel caseId={caseId} onMerged={onMerged} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-serif text-xl">My profile</h2>
        <div className="flex items-center gap-2">
          {/* Official-form auto-fill is attorney tooling only (UPL guard) —
              hidden entirely for applicants, no upsell teaser. */}
          {canDownloadPdf && <PdfDownloadButton caseId={caseId} canDownload />}
          <a href={`/cases/${caseId}/intake`} className="rounded-lg border border-border-default px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle transition-colors">
            Update profile →
          </a>
        </div>
      </div>

      {/* Degree */}
      {!!q.highestDegree && (
        <div className="rounded-xl border border-border-subtle bg-surface-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">EB-2 Basis</p>
          <p className="text-sm font-medium text-text-primary">
            {q.highestDegree === "phd" ? "PhD / Doctorate" : q.highestDegree === "md" ? "MD" : q.highestDegree === "masters" ? "Master's" : String(q.highestDegree)}
            {q.degreeInstitution ? `, ${String(q.degreeInstitution)}` : ""}
            {q.degreeYear ? ` (${String(q.degreeYear)})` : ""}
          </p>
          {!!q.degreeField && <p className="mt-0.5 text-xs text-text-muted">{String(q.degreeField)}</p>}
        </div>
      )}

      {/* Endeavor */}
      {(e.endeavorStatement as string)?.trim() && (
        <div className="rounded-xl border border-border-subtle bg-surface-card px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Proposed Endeavor</p>
          <p className="text-sm text-text-secondary leading-relaxed">{String(e.endeavorStatement)}</p>
          {(e.endeavorField as string)?.trim() && (
            <p className="mt-2 text-xs text-text-muted">Field: {String(e.endeavorField)}</p>
          )}
        </div>
      )}

      {/* Evidence summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Publications", count: pubs.length, sub: totalCitations > 0 ? `${totalCitations} citations` : undefined },
          { label: "Awards", count: awards.length, sub: undefined },
          { label: "Grants", count: grants.length, sub: undefined },
          { label: "Editorial roles", count: roles.length + talks.length, sub: talks.length > 0 ? `incl. ${talks.length} talks` : undefined },
        ].map((item) => (
          <div key={item.label} className={`rounded-xl border px-4 py-3 text-center ${item.count > 0 ? "border-border-default bg-surface-card" : "border-dashed border-border-default bg-surface-subtle"}`}>
            <p className={`text-2xl font-bold ${item.count > 0 ? "text-text-primary" : "text-text-disabled"}`}>{item.count}</p>
            <p className="text-xs text-text-muted mt-0.5">{item.label}</p>
            {item.sub && <p className="text-xs text-text-muted">{item.sub}</p>}
          </div>
        ))}
      </div>

      {/* Publication list */}
      {pubs.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-card px-5 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Publications</p>
          {pubs.map((p, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{String(p.title ?? "")}</p>
                <p className="text-xs text-text-muted">{[p.venue, p.year].filter(Boolean).join(" · ")}</p>
              </div>
              {typeof p.citations === "number" && p.citations > 0 && (
                <span className="shrink-0 rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-secondary">{p.citations} citations</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CV extraction — import additional evidence */}
      <ExtractEvidencePanel caseId={caseId} onMerged={onMerged} />
    </div>
  );
}

export function IntakeLinkPanel({ caseId }: { caseId: string }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  const send = async () => {
    if (!email.includes("@")) { setError("Enter a valid email address."); return; }
    setSending(true); setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/intake-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; intakeUrl?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setGeneratedUrl(data.intakeUrl ?? "");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send link.");
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(generatedUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-info-soft bg-info-bg px-5 py-4">
      <div className="flex items-start gap-3">
        <PetitionMark className="h-5 w-5 mt-0.5 shrink-0 text-info-fill" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-info-text">Send intake link to client</p>
          <p className="mt-0.5 text-xs text-info-text">
            Client fills in their evidence directly — no account needed. Takes 10–15 min.
          </p>
          {sent ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-success-text font-medium">Link sent to {email}</p>
              {generatedUrl && (
                <div className="flex items-center gap-2">
                  <input readOnly value={generatedUrl} className="flex-1 rounded border border-info-border bg-surface-card px-2 py-1 text-xs text-text-secondary font-mono truncate" />
                  <button type="button" className="shrink-0 rounded border border-info-border bg-surface-card px-2.5 py-1 text-xs text-info-text hover:bg-info-bg transition-colors" onClick={copy}>
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
              <button type="button" className="text-xs text-info-fill hover:text-info-text" onClick={() => { setSent(false); setEmail(""); setGeneratedUrl(""); }}>
                Send another link
              </button>
            </div>
          ) : (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="email"
                className="flex-1 rounded-lg border border-info-border bg-surface-card px-3 py-1.5 text-sm placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-info-fill"
                placeholder="client@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
              />
              <button type="button" className="shrink-0 rounded-lg bg-info-fill px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50" onClick={send} disabled={sending}>
                {sending ? "Sending…" : "Send link"}
              </button>
            </div>
          )}
          {error && <p className="mt-1.5 text-xs text-danger-fill">{error}</p>}
        </div>
      </div>
    </div>
  );
}

export function ExhibitPlanPanel({ caseId, caseData, letters }: { caseId: string; caseData: Case; letters: Record<string, LetterRecord> }) {
  const fd = caseData.formData ?? {};
  const rows = buildExhibitRows(fd, letters);
  const e = (fd.endeavor ?? {}) as Record<string, unknown>;
  const q = (fd.qualifications ?? {}) as Record<string, unknown>;
  const nstcCategories = Array.isArray(e.nstcCategories) ? (e.nstcCategories as string[]) : [];
  const federalPrograms = Array.isArray(e.federalPrograms) ? (e.federalPrograms as Record<string, unknown>[]) : [];
  const notableCitations = Array.isArray(q.notableCitations) ? (q.notableCitations as Record<string, unknown>[]) : [];

  const [copied, setCopied] = useState(false);
  const copyMarkdown = () => {
    const header = "| Prong | Item | Description |\n|-------|------|-------------|";
    const body = rows.map(r => `| ${r.prong} | ${r.item} | ${r.description} |`).join("\n");
    navigator.clipboard.writeText(`${header}\n${body}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-xl">Exhibit plan</h2>
          <p className="mt-0.5 text-sm text-text-muted">Evidence mapped to the three Dhanasar prongs — the exhibit index USCIS adjudicators expect.</p>
        </div>
        <button type="button" onClick={copyMarkdown} className="btn btn-secondary text-sm">
          {copied ? "Copied ✓" : "Copy as markdown"}
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-default px-6 py-8 text-center text-sm text-text-muted">
          No evidence collected yet. Complete the guided intake to populate this table.
        </p>
      ) : (
        <div className="rounded-xl border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle border-b border-border-default">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold text-text-secondary w-24">Prong</th>
                <th className="px-4 py-2.5 text-left font-semibold text-text-secondary w-48">Item</th>
                <th className="px-4 py-2.5 text-left font-semibold text-text-secondary">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-surface-card" : "bg-surface-subtle"}>
                  <td className="px-4 py-2.5 text-xs font-semibold text-text-muted">{row.prong}</td>
                  <td className="px-4 py-2.5 font-medium text-text-primary">{row.item}</td>
                  <td className="px-4 py-2.5 text-text-secondary">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(nstcCategories.length === 0 || federalPrograms.length === 0 || notableCitations.length === 0) && (
        <div className="rounded-lg border border-warning-border bg-warning-bg px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-warning-text">Evidence completeness gaps</p>
          {nstcCategories.length === 0 && <p className="text-xs text-warning-text">• No NSTC category selected — Prong 1 is missing a key anchor. Add in guided intake.</p>}
          {federalPrograms.length === 0 && <p className="text-xs text-warning-text">• No federal program alignment — Prong 1 lacks urgency/specificity. Add in guided intake.</p>}
          {notableCitations.length === 0 && <p className="text-xs text-warning-text">• No notable citations — Prong 2 citation argument is generic. Add in guided intake.</p>}
        </div>
      )}
    </div>
  );
}
