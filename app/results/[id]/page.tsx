import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConsentCard } from "@/app/check/result/[leadId]/ConsentCard";
import { legacyTierToCanonical, TIER_META } from "@/lib/scoring";
import { TierHero } from "@/components/TierHero";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

// Personal assessment data — must never be indexed, even if a link leaks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NEXT_STEPS: Record<string, { title: string; steps: { bold: string; text: string }[] }> = {
  strong: {
    title: "What happens next",
    steps: [
      { bold: "Attorney matching.", text: "We're onboarding vetted NIW firms now. If one wants to take your case, we'll email you — no fixed timeline, and no contact unless a firm opts in." },
      { bold: "Free strategy call.", text: "Discuss your case, your gaps, and whether NIW is the right path. No commitment." },
      { bold: "If you decide to proceed,", text: "you get a shared workspace where you and your attorney build your petition together." },
    ],
  },
  developing: {
    title: "Your next steps",
    steps: [
      { bold: "Attorney review.", text: "An attorney may review your profile and reach out if they see a path forward." },
      { bold: "Strengthen your evidence.", text: "Think about what you could add — peer review roles, grants, invited talks, or a clearer US plan." },
      { bold: "Re-assess anytime.", text: "Come back when your credentials improve — your profile is saved." },
    ],
  },
  early: {
    title: "How to strengthen your case",
    steps: [
      { bold: "Build your publication record.", text: "Aim for 5+ peer-reviewed papers with growing citations — these are the biggest levers." },
      { bold: "Connect to national priorities.", text: "Explicitly link your work to a US federal priority (healthcare, energy, AI, defense, etc.)." },
      { bold: "Re-assess in 3–6 months.", text: "Once you've strengthened your profile, come back for an updated assessment." },
    ],
  },
};

type Props = { params: Promise<{ id: string }> };

export default async function ResultsPage({ params }: Props) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { resultToken: id } });
  if (!lead) notFound();

  const canonicalTier = legacyTierToCanonical(lead.tier);
  const meta = TIER_META[canonicalTier];
  const info = NEXT_STEPS[canonicalTier];

  const fd = lead.formData as Record<string, unknown> | null;
  const field = fd ? String(fd.field ?? "Research") : "Research";

  const coreStats = fd
    ? [
        { label: "Field", value: String(fd.field ?? "") },
        { label: "Degree", value: String(fd.degree ?? "") },
        { label: "Experience", value: fd.yearsExperience ? `${fd.yearsExperience} years` : "" },
        { label: "Publications", value: String(fd.publications ?? "") },
        { label: "Citations", value: String(fd.citations ?? "") },
      ].filter((s) => s.value)
    : [];

  const deepStats = fd
    ? [
        { label: "Patents", value: String(fd.patents ?? "") },
        { label: "Awards", value: String(fd.awards ?? "") },
        { label: "Grants", value: String(fd.grants ?? "") },
        { label: "Peer review / editorial", value: String(fd.peerReview ?? "") },
        { label: "Invited talks", value: String(fd.invitedTalks ?? "") },
        { label: "National importance", value: String(fd.nationalConnection ?? "") },
        { label: "US plan", value: String(fd.usPlan ?? "") },
        { label: "Employer situation", value: String(fd.employerSituation ?? "") },
      ].filter((s) => s.value)
    : [];

  const hasDeep = deepStats.length > 0;

  return (
    <div className="mx-auto max-w-2xl py-10 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-3xl tracking-tight">Your NIW Assessment</h1>
        <p className="text-sm text-text-secondary">
          {lead.name ? `${lead.name} — ` : ""}assessed{" "}
          {new Date(lead.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </p>
      </div>

      <TierHero
        tier={canonicalTier}
        score={lead.score ?? undefined}
        pathLabel="EB-2 NIW"
        summary={`Your ${field} profile: ${meta.description}`}
      />

      {/* Core profile */}
      {coreStats.length > 0 && (
        <div className="card">
          <h2 className="font-serif text-lg mb-4">Profile Snapshot</h2>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
            {coreStats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-text-muted uppercase tracking-wider">{s.label}</dt>
                <dd className="mt-0.5 text-sm font-medium text-text-primary">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <ConsentCard leadId={lead.id} resultToken={id} initialStatus={lead.applicantStatus} />

      {hasDeep && lead.applicantStatus === "approved" ? (
        <div className="card">
          <h2 className="font-serif text-lg mb-4">Detailed Evidence</h2>
          <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-x-8">
            {deepStats.map((s) => (
              <div key={s.label} className="border-b border-border-subtle pb-2 last:border-0">
                <dt className="text-xs text-text-muted uppercase tracking-wider">{s.label}</dt>
                <dd className="mt-0.5 text-sm text-text-primary">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : hasDeep ? (
        <div className="card space-y-3">
          <h2 className="font-serif text-lg">Detailed Evidence</h2>
          <div className="space-y-2">
            {["Awards & grants", "Peer review standing", "National importance alignment", "US plan specifics"].map((label, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-muted px-4 py-2.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true"><path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" /></svg>
                <span className="text-sm text-text-secondary">{label}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-secondary">Opt in to attorney matching above to see your detailed evidence breakdown.</p>
        </div>
      ) : null}

      {/* Next steps */}
      <div className="card space-y-4">
        <h3 className="font-serif text-lg">{info.title}</h3>
        <ol className="space-y-3">
          {info.steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-secondary">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-text-secondary">
                {i + 1}
              </span>
              <span>
                <strong className="text-text-primary">{step.bold}</strong> {step.text}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="text-center space-y-3">
        <Link href="/check" className="btn btn-primary">
          Re-assess with updated credentials
        </Link>
        <p className="text-xs text-text-muted">
          This assessment is for informational purposes only and does not constitute legal advice.
        </p>
      </div>
    </div>
  );
}
