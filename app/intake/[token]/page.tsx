import { verifyIntakeToken, getCaseByIntakeToken } from "@/lib/db";
import { isIntakeVerified } from "@/lib/intake-auth";
import { TokenIntakeWizard } from "./TokenIntakeWizard";
import { IntakeVerifyGate } from "@/components/IntakeVerifyGate";

export const dynamic = "force-dynamic";

export default async function PublicIntakePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Step 1: Check if the token is valid at all (before any data loads)
  const intake = await verifyIntakeToken(token);
  if (!intake) {
    return (
      <div className="mx-auto max-w-md py-20 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-3xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl">Link expired or invalid</h1>
        <p className="text-sm text-text-muted">
          This intake link has expired or already been used. Ask your attorney to send a new link.
        </p>
      </div>
    );
  }

  // Step 2: Check if the browser has a valid verification cookie for this token
  const verified = await isIntakeVerified(token);
  if (!verified) {
    // Show the OTP gate — no case data loaded yet
    return <IntakeVerifyGate token={token} />;
  }

  // Step 3: Verified — load case data and show the wizard
  const c = await getCaseByIntakeToken(token);
  if (!c) {
    return (
      <div className="mx-auto max-w-md py-20 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-3xl">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m9.86-2.556a4.5 4.5 0 0 0-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757" />
          </svg>
        </div>
        <h1 className="font-serif text-2xl">Link expired or invalid</h1>
        <p className="text-sm text-text-muted">
          This intake link has expired or already been used. Ask your attorney to send a new link.
        </p>
      </div>
    );
  }

  const formData = (c.formData ?? {}) as Record<string, unknown>;
  const q = (formData.qualifications ?? {}) as Record<string, unknown>;
  const e = (formData.endeavor ?? {}) as Record<string, unknown>;
  const p = (formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const addr = (p.currentAddress ?? {}) as Record<string, string>;

  const initialData = {
    // Personal info (maps to petitionerInfo for I-140 prefill)
    familyName: String(p.familyName ?? ""),
    givenName: String(p.givenName ?? ""),
    middleName: String(p.middleName ?? ""),
    dob: String(p.dob ?? ""),
    cityOfBirth: String(p.cityOfBirth ?? ""),
    countryOfBirth: String(p.countryOfBirth ?? ""),
    countryOfCitizenship: String(p.countryOfCitizenship ?? ""),
    currentStatus: String(p.currentStatus ?? ""),
    addressStreet: String(addr.street ?? ""),
    addressCity: String(addr.city ?? ""),
    addressState: String(addr.state ?? ""),
    addressZip: String(addr.zip ?? ""),
    phone: String(p.phone ?? ""),
    email: String(p.email ?? ""),
    passportNumber: String(p.passportNumber ?? ""),
    passportCountry: String(p.passportCountry ?? ""),
    passportExpiry: String(p.passportExpiry ?? ""),

    highestDegree: String(q.highestDegree ?? ""),
    degreeInstitution: String(q.degreeInstitution ?? ""),
    degreeYear: q.degreeYear ? String(q.degreeYear) : "",
    degreeField: String(q.degreeField ?? ""),
    endeavorField: String(e.endeavorField ?? ""),
    endeavorPartA: String(e.endeavorPartA ?? ""),
    endeavorPartB: String(e.endeavorPartB ?? ""),
    endeavorPartC: String(e.endeavorPartC ?? ""),
    endeavorPartD: String(e.endeavorPartD ?? ""),
    endeavorStatement: String(e.endeavorStatement ?? ""),
    nationalImportanceArgument: String(e.nationalImportanceArgument ?? ""),
    nstcCategories: Array.isArray(e.nstcCategories) ? (e.nstcCategories as string[]) : [],
    federalPrograms: ((e.federalPrograms ?? []) as Record<string, unknown>[]).map(p => ({
      programName: String(p.programName ?? ""),
      agencyOrOffice: String(p.agencyOrOffice ?? ""),
      specificGoal: String(p.specificGoal ?? ""),
    })),
    researchIsPublished: e.researchIsPublished !== false,
    publications: ((q.publications ?? []) as Record<string, unknown>[]).map((p) => ({
      title: String(p.title ?? ""),
      venue: String(p.venue ?? ""),
      year: p.year ? String(p.year) : "",
      citations: p.citations !== undefined ? String(p.citations) : "",
      impactFactor: p.impactFactor !== undefined ? String(p.impactFactor) : "",
      journalRank: String(p.journalRank ?? ""),
      citationPercentile: p.citationPercentile !== undefined ? String(p.citationPercentile) : "",
      esiFieldAverage: p.esiFieldAverage !== undefined ? String(p.esiFieldAverage) : "",
    })),
    notableCitations: ((q.notableCitations ?? []) as Record<string, unknown>[]).map((c) => ({
      citingAuthor: String(c.citingAuthor ?? ""),
      citingJournal: String(c.citingJournal ?? ""),
      citingYear: c.citingYear ? String(c.citingYear) : "",
      howUsed: String(c.howUsed ?? ""),
    })),
    awards: ((q.awards ?? []) as Record<string, unknown>[]).map((a) => ({
      name: String(a.name ?? ""),
      issuer: String(a.issuer ?? ""),
      year: a.year ? String(a.year) : "",
    })),
    grants: ((q.grants ?? []) as Record<string, unknown>[]).map((g) => ({
      title: String(g.title ?? ""),
      agency: String(g.agency ?? ""),
      amount: String(g.amount ?? ""),
    })),
    editorialRoles: ((q.editorialRoles ?? []) as Record<string, unknown>[]).map((r) => ({
      journal: String(r.journal ?? ""),
      role: String(r.role ?? ""),
    })),
    invitedTalks: ((q.invitedTalks ?? []) as Record<string, unknown>[]).map((t) => ({
      title: String(t.title ?? ""),
      venue: String(t.venue ?? ""),
    })),
    usPlan: (() => {
      const up = (e.usPlan ?? {}) as Record<string, unknown>;
      return {
        institution: String(up.institution ?? ""),
        collaborators: ((up.collaborators ?? []) as Record<string, unknown>[]).map(c => ({ name: String(c.name ?? ""), institution: String(c.institution ?? ""), role: String(c.role ?? "") })),
        milestones: ((up.milestones ?? []) as Record<string, unknown>[]).map(m => ({ description: String(m.description ?? ""), timeline: String(m.timeline ?? "") })),
        fundingSources: ((up.fundingSources ?? []) as Record<string, unknown>[]).map(f => ({ source: String(f.source ?? ""), status: String(f.status ?? "") })),
      };
    })(),
    recommenders: ((formData.recommenders ?? []) as Record<string, unknown>[]).map((r) => ({
      name: String(r.name ?? ""),
      title: String(r.title ?? ""),
      institution: String(r.institution ?? ""),
      credentials: String(r.credentials ?? ""),
      relationship: String(r.relationship ?? ""),
      email: String(r.email ?? ""),
      kind: (r.kind === "dependent" ? "dependent" : "independent") as "independent" | "dependent",
    })),
    _existingQualifications: q,
  };

  return (
    <TokenIntakeWizard
      token={token}
      caseTitle={c.title}
      initialData={initialData}
    />
  );
}
