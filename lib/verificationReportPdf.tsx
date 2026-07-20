import { Document, Page, Text, View, Link, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

type ClaimResult = {
  status: string;
  source: string;
  sourceUrl?: string;
  confidence: number;
  detail?: string;
};

type Props = {
  leadId: string;
  trustScore: number;
  verifiedClaims: Record<string, ClaimResult>;
  generatedAt: Date;
};

const SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  orcid: "ORCID",
  ror: "ROR",
  nsf: "NSF Award Search",
  nih: "NIH RePORTER",
  uspto: "USPTO PatentsView",
  crossref: "Crossref",
};

const CLAIM_LABELS: Record<string, string> = {
  researcher_profile: "Research profile",
  publications: "Publications",
  orcid: "ORCID",
  institution: "Institution",
  nsf_grants: "NSF grants",
  nih_grants: "NIH grants",
  patents: "Patents",
  awards: "Awards",
  peerReview: "Peer review roles",
  invitedTalks: "Invited talks",
};

const STATUS_COLORS: Record<string, string> = {
  verified: "#15803d",
  self_reported: "#b45309",
  contradicted: "#dc2626",
  not_found: "#78716c",
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    color: "#1c1917",
    backgroundColor: "#ffffff",
  },
  // Header
  headerPlatform: { fontSize: 8, color: "#78716c", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 },
  headerTitle: { fontFamily: "Helvetica-Bold", fontSize: 16, color: "#1c1917", marginBottom: 4 },
  headerMeta: { fontSize: 9, color: "#57534e", marginBottom: 2 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#d6d3d1", marginVertical: 12 },

  // Trust score
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  scoreBox: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderRadius: 4 },
  scoreLabel: { fontSize: 8, color: "#78716c", textTransform: "uppercase", letterSpacing: 0.5 },
  scoreValue: { fontFamily: "Helvetica-Bold", fontSize: 18, marginTop: 2 },
  scoreNote: { fontSize: 9, color: "#57534e", flex: 1 },

  // Claims table
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f4", paddingVertical: 5, paddingHorizontal: 6, borderWidth: 0.5, borderColor: "#d6d3d1" },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4" },
  tableRowAlt: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4", backgroundColor: "#fafaf9" },
  tableHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#57534e", textTransform: "uppercase", letterSpacing: 0.5 },
  colClaim: { width: "28%" },
  colStatus: { width: "18%" },
  colSource: { width: "22%" },
  colRef: { width: "32%" },

  // Footer
  footer: { position: "absolute", bottom: 30, left: 50, right: 50 },
  footerText: { fontSize: 7, color: "#a8a29e", textAlign: "center", lineHeight: 1.6 },
  footerLink: { fontSize: 7, color: "#3b82f6" },
});

function VerificationReportDocument({ leadId, trustScore, verifiedClaims, generatedAt }: Props) {
  const entries = Object.entries(verifiedClaims)
    .filter(([key]) => key !== "preliminary")
    .sort(([, a], [, b]) => {
      const order: Record<string, number> = { verified: 0, self_reported: 1, not_found: 2, contradicted: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

  const scoreColor = trustScore >= 80 ? "#15803d" : trustScore >= 60 ? "#b45309" : trustScore > 0 ? "#dc2626" : "#78716c";
  const scoreBorderColor = trustScore >= 80 ? "#86efac" : trustScore >= 60 ? "#fde68a" : trustScore > 0 ? "#fecaca" : "#d6d3d1";

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <Text style={s.headerPlatform}>PetitionHQ</Text>
        <Text style={s.headerTitle}>Verification Report</Text>
        <Text style={s.headerMeta}>Lead #{leadId.slice(0, 8)}</Text>
        <Text style={s.headerMeta}>
          Generated {generatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          {" at "}
          {generatedAt.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </Text>

        <View style={s.divider} />

        {/* Trust Score */}
        <View style={s.scoreRow}>
          <View style={[s.scoreBox, { borderColor: scoreBorderColor }]}>
            <Text style={s.scoreLabel}>Trust Score</Text>
            <Text style={[s.scoreValue, { color: scoreColor }]}>{trustScore}/100</Text>
          </View>
          <Text style={s.scoreNote}>
            Score computed from public API lookups (OpenAlex, ORCID, ROR, NSF, NIH, USPTO).
            Higher scores indicate more claims independently confirmed. See methodology at petitionhq.us/verification.
          </Text>
        </View>

        {/* Claims Table */}
        <View style={s.tableHeader}>
          <View style={s.colClaim}><Text style={s.tableHeaderText}>Claim</Text></View>
          <View style={s.colStatus}><Text style={s.tableHeaderText}>Status</Text></View>
          <View style={s.colSource}><Text style={s.tableHeaderText}>Source</Text></View>
          <View style={s.colRef}><Text style={s.tableHeaderText}>Reference</Text></View>
        </View>

        {entries.map(([key, claim], i) => {
          const label = CLAIM_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const statusColor = STATUS_COLORS[claim.status] ?? "#78716c";
          const sourceLabel = SOURCE_LABELS[claim.source] ?? claim.source;
          const statusLabel = claim.status === "self_reported" ? "Self-Reported" :
            claim.status.charAt(0).toUpperCase() + claim.status.slice(1);

          return (
            <View key={key} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <View style={s.colClaim}>
                <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1c1917" }}>{label}</Text>
                {claim.detail && <Text style={{ fontSize: 8, color: "#57534e", marginTop: 1 }}>{claim.detail}</Text>}
              </View>
              <View style={s.colStatus}>
                <Text style={{ fontSize: 9, color: statusColor, fontFamily: "Helvetica-Bold" }}>{statusLabel}</Text>
              </View>
              <View style={s.colSource}>
                <Text style={{ fontSize: 9, color: "#44403c" }}>
                  {claim.status === "self_reported" ? "Applicant" : sourceLabel}
                </Text>
              </View>
              <View style={s.colRef}>
                {claim.sourceUrl ? (
                  <Link src={claim.sourceUrl} style={{ fontSize: 8, color: "#3b82f6", textDecoration: "none" }}>
                    {claim.sourceUrl.length > 45 ? claim.sourceUrl.slice(0, 42) + "..." : claim.sourceUrl}
                  </Link>
                ) : (
                  <Text style={{ fontSize: 8, color: "#a8a29e" }}>{"—"}</Text>
                )}
              </View>
            </View>
          );
        })}

        {/* Footer */}
        <View style={s.footer} fixed>
          <View style={s.divider} />
          <Text style={s.footerText}>
            Verification performed via public APIs. Claims marked Self-Reported are taken from applicant intake and not independently confirmed.
          </Text>
          <Text style={s.footerText}>
            Methodology:{" "}
            <Link src="https://petitionhq.us/verification" style={s.footerLink}>
              petitionhq.us/verification
            </Link>
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Render the verification report PDF to a Buffer.
 */
export async function renderVerificationReportPdf(props: Props): Promise<Buffer> {
  return renderToBuffer(
    <VerificationReportDocument {...props} />
  ) as unknown as Promise<Buffer>;
}
