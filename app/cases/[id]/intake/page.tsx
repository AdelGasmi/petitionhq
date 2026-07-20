import { redirect } from "next/navigation";
import { readCase } from "@/lib/db";
import { getSession, canAccessCase } from "@/lib/auth";
import { IntakeWizard } from "./IntakeWizard";

export const dynamic = "force-dynamic";

export default async function IntakePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const c = await readCase(id);
  if (!c || !canAccessCase(session, c)) redirect("/cases");

  // Intake wizard is NIW-only
  if (c.formId !== "i140-niw") redirect(`/cases/${id}`);

  const formData = (c.formData ?? {}) as Record<string, unknown>;
  const p = (formData.petitionerInfo ?? {}) as Record<string, unknown>;
  const addr = (p.currentAddress ?? {}) as Record<string, unknown>;
  const q = (formData.qualifications ?? {}) as Record<string, unknown>;
  const e = (formData.endeavor ?? {}) as Record<string, unknown>;

  const initialData = {
    // Step 0 — Personal info
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

    // Step 1 — EB-2 basis
    highestDegree: String(q.highestDegree ?? ""),
    degreeInstitution: String(q.degreeInstitution ?? ""),
    degreeYear: q.degreeYear ? String(q.degreeYear) : "",
    degreeField: String(q.degreeField ?? ""),

    // Step 2 — Endeavor
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

    // Step 3 — Publications
    publications: ((q.publications ?? []) as Record<string, unknown>[]).map((pub) => ({
      title: String(pub.title ?? ""),
      venue: String(pub.venue ?? ""),
      year: pub.year ? String(pub.year) : "",
      citations: pub.citations !== undefined ? String(pub.citations) : "",
      impactFactor: pub.impactFactor !== undefined ? String(pub.impactFactor) : "",
      journalRank: String(pub.journalRank ?? ""),
      citationPercentile: pub.citationPercentile !== undefined ? String(pub.citationPercentile) : "",
      esiFieldAverage: pub.esiFieldAverage !== undefined ? String(pub.esiFieldAverage) : "",
    })),

    // Step 4 — Recognition
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
    // Step 5 — Recommenders
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
    <IntakeWizard
      caseId={id}
      caseTitle={c.title}
      initialData={initialData}
    />
  );
}
