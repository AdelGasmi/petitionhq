// Builds the read-only "Peek" snippet shown inline in the admin lead pipeline.
// Pure + serializable so the server page can pre-extract it and hand it to the
// client table — no formData (which can be large) crosses the wire, just the bits
// we render.

export type LeadSnippet = {
  chips: { label: string; value: string }[];
  summary: string | null;
  blockers: string | null;
};

function truncate(s: unknown, n: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
}

export function buildSnippet(formData: unknown): LeadSnippet {
  const fd = (formData && typeof formData === "object" ? formData : {}) as Record<string, unknown>;

  const chips = (
    [
      { label: "Field", value: fd.field },
      { label: "Degree", value: fd.degree },
      { label: "Exp", value: typeof fd.yearsExperience === "number" ? `${fd.yearsExperience}y` : fd.yearsExperience },
      { label: "Pubs", value: fd.publications },
      { label: "Cites", value: fd.citations },
      { label: "Patents", value: fd.patents },
      { label: "Awards", value: fd.awards },
      { label: "Grants", value: fd.grants },
    ] as { label: string; value: unknown }[]
  )
    .filter((c) => c.value != null && c.value !== "" && c.value !== "0" && c.value !== 0)
    .map((c) => ({ label: c.label, value: String(c.value) }));

  const gap = (fd._gapNarrative && typeof fd._gapNarrative === "object" ? fd._gapNarrative : {}) as Record<string, unknown>;

  return {
    chips,
    summary: truncate(fd._summary, 260),
    blockers: truncate(gap.blockers, 200),
  };
}
