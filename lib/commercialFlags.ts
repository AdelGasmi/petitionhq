export type FlagColor = "green" | "yellow" | "grey";

export type CommercialFlag = {
  label: string;
  value: string;
  color: FlagColor;
};

export type CommercialFlags = {
  usPlan: CommercialFlag;
  selfPetitionFit: CommercialFlag;
  nationalHook: CommercialFlag;
};

export function deriveCommercialFlags(formData: Record<string, unknown> | null): CommercialFlags {
  const usPlanRaw = String(formData?.usPlan ?? "");
  const employerRaw = String(formData?.employerSituation ?? "");
  const nationalRaw = String(formData?.nationalConnection ?? "");

  const usPlanColor: FlagColor =
    usPlanRaw.startsWith("Funded position") ? "green"
    : usPlanRaw.startsWith("Named institution") ? "yellow"
    : "grey";

  const selfPetitionColor: FlagColor =
    employerRaw.startsWith("My research is self-directed") || employerRaw.startsWith("My field rarely") ? "green"
    : employerRaw.startsWith("No employer has offered") ? "yellow"
    : "grey";

  const nationalColor: FlagColor =
    nationalRaw.startsWith("My work directly") || nationalRaw.startsWith("I can name a specific") ? "green"
    : nationalRaw.startsWith("General benefit") ? "yellow"
    : "grey";

  const usPlanLabel =
    usPlanColor === "green" ? "Funded / signed"
    : usPlanColor === "yellow" ? "Named target"
    : usPlanRaw ? "No concrete plan" : "Not answered";

  const selfPetitionLabel =
    selfPetitionColor === "green" ? "Self-petition fit"
    : selfPetitionColor === "yellow" ? "No sponsor yet"
    : employerRaw.startsWith("I have an employer") ? "Has PERM sponsor"
    : employerRaw ? "Has employer" : "Not answered";

  const nationalLabel =
    nationalColor === "green" ? "Named initiative"
    : nationalColor === "yellow" ? "General US benefit"
    : nationalRaw ? "No clear hook" : "Not answered";

  return {
    usPlan: { label: "US Plan", value: usPlanLabel, color: usPlanColor },
    selfPetitionFit: { label: "Self-petition", value: selfPetitionLabel, color: selfPetitionColor },
    nationalHook: { label: "National interest", value: nationalLabel, color: nationalColor },
  };
}
