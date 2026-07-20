import type { LetterRecord } from "./db";

export type ExhibitRow = { prong: string; item: string; description: string };

export function buildExhibitRows(
  formData: Record<string, unknown>,
  letters: Record<string, LetterRecord> = {}
): ExhibitRow[] {
  const q = (formData.qualifications ?? {}) as Record<string, unknown>;
  const e = (formData.endeavor ?? {}) as Record<string, unknown>;

  const pubs = Array.isArray(q.publications) ? (q.publications as Record<string, unknown>[]) : [];
  const grants = Array.isArray(q.grants) ? (q.grants as Record<string, unknown>[]) : [];
  const editorialRoles = Array.isArray(q.editorialRoles) ? (q.editorialRoles as Record<string, unknown>[]) : [];
  const notableCitations = Array.isArray(q.notableCitations) ? (q.notableCitations as Record<string, unknown>[]) : [];
  const nstcCategories = Array.isArray(e.nstcCategories) ? (e.nstcCategories as string[]) : [];
  const federalPrograms = Array.isArray(e.federalPrograms) ? (e.federalPrograms as Record<string, unknown>[]) : [];

  const allLetters = Object.values(letters);
  const depLetters = allLetters.filter(l => l.recommender?.kind === "dependent" || !l.recommender?.kind || l.recommender?.kind === "academic");
  const indLetters = allLetters.filter(l => l.recommender?.kind === "independent");
  const govLetters = allLetters.filter(l => l.recommender?.kind === "governmental");

  const degree = String(q.highestDegree ?? "");
  const institution = String(q.degreeInstitution ?? "");
  const degreeYear = q.degreeYear ? String(q.degreeYear) : "";
  const topVenues = [...new Set(pubs.map(p => String(p.venue ?? "")).filter(Boolean))].slice(0, 3).join(", ");
  const totalCitations = pubs.reduce((sum, p) => sum + (typeof p.citations === "number" ? p.citations : 0), 0);
  const esiPapers = pubs.filter(p => typeof p.citationPercentile === "number" && (p.citationPercentile as number) >= 90).length;

  const rows: ExhibitRow[] = [
    ...(degree ? [{ prong: "EB-2", item: "Degree documents", description: `${degree.toUpperCase()} from ${institution}${degreeYear ? `, ${degreeYear}` : ""}` }] : []),
    ...(e.endeavorStatement ? [{ prong: "Prong 1", item: "Proposed Endeavor Statement", description: `Signed PES — ${String(e.endeavorField ?? "field not specified")}` }] : []),
    ...federalPrograms.filter(fp => fp.programName).map(fp => ({
      prong: "Prong 1",
      item: "Federal program alignment",
      description: `${fp.programName}${fp.agencyOrOffice ? ` — ${fp.agencyOrOffice}` : ""}${fp.specificGoal ? ` (goal: ${fp.specificGoal})` : ""}`,
    })),
    ...(nstcCategories.length ? [{ prong: "Prong 1", item: "NSTC CET list", description: `Work falls under: ${nstcCategories.join(", ")}` }] : []),
    ...grants.filter(g => g.title).map(g => ({
      prong: "Prong 1",
      item: "Funding evidence",
      description: `${g.agency ?? "Agency"} — ${g.amount ?? "amount TBD"}`,
    })),
    ...(pubs.length ? [{ prong: "Prong 2", item: `Publications (${pubs.length})`, description: `${pubs.length} peer-reviewed papers${topVenues ? ` — top venues: ${topVenues}` : ""}` }] : []),
    ...(totalCitations > 0 || esiPapers > 0 ? [{
      prong: "Prong 2",
      item: "Citation record",
      description: `${totalCitations > 0 ? `${totalCitations} total citations` : ""}${esiPapers > 0 ? `${totalCitations > 0 ? " — " : ""}${esiPapers} paper${esiPapers > 1 ? "s" : ""} in top 10% by ESI` : ""}`,
    }] : []),
    ...notableCitations.filter(c => c.citingAuthor || c.citingJournal).map(c => ({
      prong: "Prong 2",
      item: "Notable citation",
      description: `${c.citingAuthor ?? ""}${c.citingYear ? ` (${c.citingYear})` : ""} — ${c.howUsed ? String(c.howUsed).slice(0, 80) + (String(c.howUsed).length > 80 ? "…" : "") : "cited"}`,
    })),
    ...(editorialRoles.length ? [{ prong: "Prong 2", item: "Peer review service", description: `${editorialRoles.length} editorial/reviewer role${editorialRoles.length > 1 ? "s" : ""}` }] : []),
    ...(allLetters.length ? [{
      prong: "Prong 2",
      item: "Letters of recommendation",
      description: `${allLetters.length} letter${allLetters.length > 1 ? "s" : ""} — ${depLetters.length} dependent, ${indLetters.length} independent, ${govLetters.length} governmental`,
    }] : []),
    { prong: "Prong 3", item: "CV + degrees", description: "Specialized skillset exceeding labor certification minimum requirements" },
  ];

  return rows;
}

export function exhibitRowsToMarkdown(rows: ExhibitRow[]): string {
  const header = "| Prong | Item | Description |\n|-------|------|-------------|";
  return `${header}\n${rows.map(r => `| ${r.prong} | ${r.item} | ${r.description} |`).join("\n")}`;
}
