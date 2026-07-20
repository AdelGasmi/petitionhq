import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { DossierData } from "./dossierGenerator";
import type { ExhibitRow } from "./exhibitPlan";
import { TIER_META } from "./scoring";

const TIER_LABEL: Record<string, string> = {
  tier1: `Tier 1 — ${TIER_META.strong.longLabel}`,
  tier2: `Tier 2 — ${TIER_META.developing.longLabel}`,
  tier3: `Tier 3 — ${TIER_META.early.longLabel}`,
};

const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 60,
    color: "#1c1917",
    backgroundColor: "#ffffff",
  },
  coverPage: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.5,
    paddingTop: 80,
    paddingBottom: 80,
    paddingHorizontal: 60,
    color: "#1c1917",
    backgroundColor: "#ffffff",
  },
  // Cover
  coverPlatform: { fontSize: 9, color: "#78716c", letterSpacing: 2, textTransform: "uppercase", marginBottom: 48 },
  coverTitle: { fontFamily: "Helvetica-Bold", fontSize: 22, color: "#1c1917", marginBottom: 8 },
  coverSubtitle: { fontSize: 12, color: "#57534e", marginBottom: 4 },
  coverTierBadge: { fontSize: 11, color: "#292524", marginTop: 16, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: "#a8a29e", alignSelf: "flex-start" },
  coverMeta: { fontSize: 9, color: "#78716c", marginTop: 48 },
  coverDisclaimer: { fontSize: 8, color: "#a8a29e", marginTop: 8, maxWidth: 400 },
  coverProvenance: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#44403c", marginTop: 16, paddingVertical: 6, paddingHorizontal: 8, borderWidth: 1, borderColor: "#78716c", maxWidth: 400 },

  // Section headings
  sectionHeading: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#1c1917", marginBottom: 8, marginTop: 20, letterSpacing: 0.5, textTransform: "uppercase" },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#d6d3d1", marginBottom: 14 },

  // Profile summary
  profileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  profileCell: { width: "45%", marginBottom: 8 },
  profileLabel: { fontSize: 8, color: "#78716c", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  profileValue: { fontSize: 10, color: "#1c1917", fontFamily: "Helvetica-Bold" },

  // Exhibit table
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f4", paddingVertical: 5, paddingHorizontal: 6, borderWidth: 0.5, borderColor: "#d6d3d1" },
  tableRow: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4" },
  tableRowAlt: { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4", backgroundColor: "#fafaf9" },
  colProng: { width: "18%", fontSize: 8, fontFamily: "Helvetica-Bold", color: "#78716c" },
  colItem: { width: "30%", fontSize: 9, color: "#1c1917" },
  colDesc: { width: "52%", fontSize: 9, color: "#44403c" },
  tableHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#57534e", textTransform: "uppercase", letterSpacing: 0.5 },

  // Draft section
  draftBody: { fontSize: 10, color: "#1c1917", lineHeight: 1.6, marginBottom: 6 },
  draftH1: { fontFamily: "Helvetica-Bold", fontSize: 13, color: "#1c1917", marginTop: 16, marginBottom: 6, letterSpacing: 0.3, textTransform: "uppercase" },
  draftH2: { fontFamily: "Helvetica-Bold", fontSize: 11, color: "#292524", marginTop: 12, marginBottom: 4 },
  draftH3: { fontFamily: "Helvetica-Bold", fontSize: 10, color: "#44403c", marginTop: 10, marginBottom: 3 },
  draftParagraph: { fontSize: 10, color: "#1c1917", lineHeight: 1.7, marginBottom: 8 },
  draftBold: { fontFamily: "Helvetica-Bold" },
  blurredNotice: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "#f5f5f4",
    borderWidth: 0.5,
    borderColor: "#d6d3d1",
    borderStyle: "dashed",
  },
  blurredLabel: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#78716c", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  blurredText: { fontSize: 9, color: "#a8a29e" },

  // Draft header banner
  draftBanner: { backgroundColor: "#fef3c7", borderWidth: 0.5, borderColor: "#f59e0b", paddingVertical: 6, paddingHorizontal: 10, marginBottom: 16, alignSelf: "flex-start" },
  draftBannerText: { fontFamily: "Helvetica-Bold", fontSize: 8, color: "#92400e", textTransform: "uppercase", letterSpacing: 1 },

  // Footer
  footer: { position: "absolute", bottom: 30, left: 60, right: 60, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#a8a29e" },

  // Verification table
  vtHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  vtSubtitle: { fontSize: 8, color: "#78716c", marginTop: 2 },
  vtBadge: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 4, alignItems: "center" },
  vtBadgeLabel: { fontSize: 7, color: "#78716c", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  vtBadgeScore: { fontFamily: "Helvetica-Bold", fontSize: 14 },
  vtTableHeader: { flexDirection: "row", backgroundColor: "#f5f5f4", paddingVertical: 4, paddingHorizontal: 6, borderWidth: 0.5, borderColor: "#d6d3d1" },
  vtRow: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4" },
  vtRowAlt: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e7e5e4", backgroundColor: "#fafaf9" },
  vtColClaim: { width: "30%", fontSize: 8, color: "#1c1917" },
  vtColStatus: { width: "18%", fontSize: 8 },
  vtColSource: { width: "22%", fontSize: 8, color: "#78716c" },
  vtColDetail: { width: "30%", fontSize: 8, color: "#44403c" },
  vtHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 7, color: "#57534e", textTransform: "uppercase" as const, letterSpacing: 0.5 },
  vtStatusVerified: { color: "#15803d", fontFamily: "Helvetica-Bold" },
  vtStatusSelfReported: { color: "#b45309", fontStyle: "italic" as const },
  vtStatusContradicted: { color: "#dc2626", fontFamily: "Helvetica-Bold" },
  vtStatusAmbiguous: { color: "#b45309", fontFamily: "Helvetica-Bold" },
  vtStatusNotFound: { color: "#78716c" },
  vtDisclaimer: { fontSize: 7, color: "#a8a29e", marginTop: 6 },
});

// Truncate to ~400 words for the visible preview
function previewWords(text: string, wordCount = 400): { preview: string; hasMore: boolean } {
  const words = text.split(/\s+/);
  if (words.length <= wordCount) return { preview: text, hasMore: false };
  return { preview: words.slice(0, wordCount).join(" ") + "…", hasMore: true };
}

// ---------------------------------------------------------------------------
// Verification & Provenance table (PDF version of VerificationDetails.tsx)
// ---------------------------------------------------------------------------

type PdfClaimResult = {
  status: string;
  source: string;
  sourceUrl?: string;
  confidence: number;
  detail?: string;
};

const PDF_CLAIM_LABELS: Record<string, string> = {
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

const PDF_SOURCE_LABELS: Record<string, string> = {
  openalex: "OpenAlex",
  orcid: "ORCID",
  ror: "ROR",
  nsf: "NSF Award Search",
  nih: "NIH RePORTER",
  uspto: "USPTO PatentsView",
  crossref: "Crossref",
  semantic_scholar: "Semantic Scholar",
  arxiv: "arXiv",
  dblp: "DBLP",
};

function trustScoreColor(score: number): { bg: string; border: string; text: string } {
  if (score >= 80) return { bg: "#f0fdf4", border: "#bbf7d0", text: "#15803d" };
  if (score >= 60) return { bg: "#fffbeb", border: "#fde68a", text: "#b45309" };
  if (score > 0)   return { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" };
  return { bg: "#f5f5f4", border: "#d6d3d1", text: "#78716c" };
}

function statusStyle(status: string) {
  switch (status) {
    case "verified":      return s.vtStatusVerified;
    case "self_reported":  return s.vtStatusSelfReported;
    case "contradicted":   return s.vtStatusContradicted;
    case "ambiguous":      return s.vtStatusAmbiguous;
    default:               return s.vtStatusNotFound;
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "verified":       return "✓ Corroborated";
    case "self_reported":  return "Self-reported";
    case "contradicted":   return "✗ Contradicted";
    case "ambiguous":      return "⚠ Ambiguous";
    case "not_found":      return "Not found";
    default:               return status;
  }
}

function VerificationTable({ trustScore, verifiedClaims }: { trustScore: number; verifiedClaims: Record<string, PdfClaimResult> }) {
  const entries = Object.entries(verifiedClaims)
    .filter(([key]) => key !== "preliminary")
    .sort(([, a], [, b]) => {
      const order: Record<string, number> = { verified: 0, self_reported: 1, not_found: 2, contradicted: 3 };
      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
    });

  if (entries.length === 0) return null;

  const tsColor = trustScoreColor(trustScore);

  return (
    <View style={{ marginTop: 16 }}>
      {/* Header row with title + trust badge */}
      <View style={s.vtHeader}>
        <View>
          <Text style={s.sectionHeading}>Verification &amp; Provenance</Text>
          <Text style={s.vtSubtitle}>
            10-source verification via public APIs — self-reported items not independently confirmed.
          </Text>
        </View>
        <View style={[s.vtBadge, { backgroundColor: tsColor.bg, borderWidth: 0.5, borderColor: tsColor.border }]}>
          <Text style={s.vtBadgeLabel}>Trust</Text>
          <Text style={[s.vtBadgeScore, { color: tsColor.text }]}>{trustScore}</Text>
        </View>
      </View>
      <View style={s.divider} />

      {/* Table header */}
      <View style={s.vtTableHeader}>
        <Text style={[s.vtColClaim, s.vtHeaderText]}>Claim</Text>
        <Text style={[s.vtColStatus, s.vtHeaderText]}>Status</Text>
        <Text style={[s.vtColSource, s.vtHeaderText]}>Source</Text>
        <Text style={[s.vtColDetail, s.vtHeaderText]}>Detail</Text>
      </View>

      {/* Rows */}
      {entries.map(([key, claim], i) => {
        const label = PDF_CLAIM_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const sourceLabel = claim.status === "self_reported" ? "—" : (PDF_SOURCE_LABELS[claim.source] ?? claim.source);
        const detail = claim.detail ? (claim.detail.length > 80 ? claim.detail.slice(0, 77) + "…" : claim.detail) : "—";

        return (
          <View key={key} style={i % 2 === 0 ? s.vtRow : s.vtRowAlt}>
            <Text style={[s.vtColClaim, { fontFamily: "Helvetica-Bold" }]}>{label}</Text>
            <Text style={[s.vtColStatus, statusStyle(claim.status)]}>{statusLabel(claim.status)}</Text>
            <Text style={s.vtColSource}>{sourceLabel}</Text>
            <Text style={s.vtColDetail}>{detail}</Text>
          </View>
        );
      })}

      <Text style={s.vtDisclaimer}>
        Verification performed automatically via OpenAlex, ORCID, ROR, Crossref, NSF, NIH, USPTO, Semantic Scholar, arXiv, and DBLP.
        Source URLs available in the online verification report.
      </Text>
    </View>
  );
}

/**
 * Parse markdown-ish text into structured blocks for PDF rendering.
 * Handles: # H1, ## H2, ### H3, **bold** inline, paragraph breaks (\n\n).
 * Strips raw markdown symbols so they never appear in the PDF.
 */
type DraftBlock =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "paragraph"; text: string };

function parseMarkdownBlocks(raw: string): DraftBlock[] {
  // Normalize line breaks — collapse \r\n to \n
  const normalized = raw.replace(/\r\n/g, "\n");

  // Split by double newlines (or more) into raw blocks
  const rawBlocks = normalized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const blocks: DraftBlock[] = [];

  for (const block of rawBlocks) {
    // Check for heading at start of block
    const h1Match = block.match(/^#{1}\s+(.+)$/m);
    const h2Match = block.match(/^#{2}\s+(.+)$/m);
    const h3Match = block.match(/^#{3}\s+(.+)$/m);

    if (h3Match && block.startsWith("###")) {
      blocks.push({ type: "h3", text: stripInlineMarkdown(h3Match[1]) });
      // If there's content after the heading line, add as paragraph
      const rest = block.replace(/^###\s+.+\n?/, "").trim();
      if (rest) blocks.push({ type: "paragraph", text: stripInlineMarkdown(rest) });
    } else if (h2Match && block.startsWith("##")) {
      blocks.push({ type: "h2", text: stripInlineMarkdown(h2Match[1]) });
      const rest = block.replace(/^##\s+.+\n?/, "").trim();
      if (rest) blocks.push({ type: "paragraph", text: stripInlineMarkdown(rest) });
    } else if (h1Match && block.startsWith("#")) {
      blocks.push({ type: "h1", text: stripInlineMarkdown(h1Match[1]) });
      const rest = block.replace(/^#\s+.+\n?/, "").trim();
      if (rest) blocks.push({ type: "paragraph", text: stripInlineMarkdown(rest) });
    } else {
      // Regular paragraph — collapse single newlines to spaces
      const text = block.replace(/\n/g, " ").replace(/\s+/g, " ");
      blocks.push({ type: "paragraph", text: stripInlineMarkdown(text) });
    }
  }

  return blocks;
}

/** Strip inline markdown: **bold**, *italic*, `code` → plain text */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")   // **bold**
    .replace(/\*(.+?)\*/g, "$1")        // *italic*
    .replace(/`(.+?)`/g, "$1")          // `code`
    .replace(/_{2}(.+?)_{2}/g, "$1")    // __bold__
    .replace(/_(.+?)_/g, "$1")          // _italic_
    .trim();
}

/** Render parsed blocks as react-pdf elements */
function DraftBlocks({ blocks }: { blocks: DraftBlock[] }) {
  return (
    <View>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "h1":
            return <Text key={i} style={s.draftH1}>{block.text}</Text>;
          case "h2":
            return <Text key={i} style={s.draftH2}>{block.text}</Text>;
          case "h3":
            return <Text key={i} style={s.draftH3}>{block.text}</Text>;
          case "paragraph":
            return <Text key={i} style={s.draftParagraph}>{block.text}</Text>;
          default:
            return null;
        }
      })}
    </View>
  );
}

type DossierDocProps = {
  data: DossierData;
  generatedDate: string;
  trustScore?: number;
  verifiedClaims?: Record<string, PdfClaimResult> | null;
};

function ProfileSummary({ data }: { data: DossierData }) {
  const q = (data as unknown as { formData?: Record<string, unknown> }).formData;
  const qualifications = q ? ((q.qualifications ?? {}) as Record<string, unknown>) : {};
  const pubs = Array.isArray(qualifications.publications) ? qualifications.publications as Record<string, unknown>[] : [];
  const totalCitations = pubs.reduce((s, p) => s + (typeof p.citations === "number" ? p.citations : 0), 0);
  const degree = String(qualifications.highestDegree ?? "");
  const institution = String(qualifications.degreeInstitution ?? "");

  const credScore = data.qualityReport?.partnerCredibilityScore ?? null;
  const credLabel = credScore !== null
    ? credScore >= 90 ? `${credScore} — Ready`
    : credScore >= 80 ? `${credScore} — Strong`
    : credScore >= 70 ? `${credScore} — Serviceable`
    : `${credScore} — Needs Work`
    : "—";

  const cells = [
    { label: "Field", value: data.field },
    { label: "Degree", value: degree ? `${degree.toUpperCase()}${institution ? ` — ${institution}` : ""}` : "Not specified" },
    { label: "Publications", value: pubs.length > 0 ? `${pubs.length} peer-reviewed` : "See profile" },
    { label: "Total citations", value: totalCitations > 0 ? String(totalCitations) : "See profile" },
    { label: "Assessment tier", value: TIER_LABEL[data.tier] ?? data.tier },
    { label: "Score", value: data.score !== null ? `${data.score} / 100` : "—" },
    { label: "Brief quality", value: credLabel },
  ];

  return (
    <View style={s.profileGrid}>
      {cells.map(c => (
        <View key={c.label} style={s.profileCell}>
          <Text style={s.profileLabel}>{c.label}</Text>
          <Text style={s.profileValue}>{c.value}</Text>
        </View>
      ))}
    </View>
  );
}

function ExhibitTable({ rows }: { rows: ExhibitRow[] }) {
  return (
    <View>
      <View style={s.tableHeader}>
        <Text style={[s.colProng, s.tableHeaderText]}>Prong</Text>
        <Text style={[s.colItem, s.tableHeaderText]}>Item</Text>
        <Text style={[s.colDesc, s.tableHeaderText]}>Description</Text>
      </View>
      {rows.map((row, i) => (
        <View key={i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
          <Text style={s.colProng}>{row.prong}</Text>
          <Text style={s.colItem}>{row.item}</Text>
          <Text style={s.colDesc}>{row.description}</Text>
        </View>
      ))}
    </View>
  );
}

function BriefSection({ title, draft }: { title: string; draft: string }) {
  const { preview, hasMore } = previewWords(draft, 600);
  const blocks = parseMarkdownBlocks(preview);
  return (
    <View>
      <Text style={s.sectionHeading}>{title}</Text>
      <View style={s.divider} />
      <DraftBlocks blocks={blocks} />
      {hasMore && (
        <Text style={{ fontSize: 8, color: "#a8a29e", marginTop: 4 }}>
          [Section truncated for preview — full text available in attorney workspace]
        </Text>
      )}
    </View>
  );
}

function formatAttestationDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function DossierDocument({ data, generatedDate, trustScore, verifiedClaims }: DossierDocProps) {
  const brief = data.brief ?? {
    substantialMerit: data.prong1Draft,
    nationalImportance: "",
    waiverJustification: "",
  };

  return (
    <Document>
      {/* Cover page */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverPlatform}>EB-2 NIW Case Assessment</Text>
        <Text style={s.coverTitle}>
          {data.field} Researcher
        </Text>
        <Text style={s.coverSubtitle}>National Interest Waiver (I-140) Petition Analysis</Text>
        <View style={s.coverTierBadge}>
          <Text>{TIER_LABEL[data.tier] ?? data.tier}</Text>
        </View>
        <Text style={[s.coverMeta, { marginTop: 60 }]}>
          Applicant: {data.applicantName}
        </Text>
        <Text style={s.coverMeta}>Generated: {generatedDate}</Text>
        <Text style={s.coverDisclaimer}>
          This dossier is a preliminary AI-assisted assessment prepared for attorney review only.
          It does not constitute legal advice. All drafts require attorney review before use in any filing.
        </Text>
        {data.attestation && (
          <Text style={s.coverProvenance}>
            Generated solely from the attorney-approved claim set #{data.attestation.ledgerRoot.slice(0, 12)}
            {data.attestation.attorneyName ? `, approved by ${data.attestation.attorneyName}` : ""}
            {" "}on {formatAttestationDate(data.attestation.attestedAt)}.
          </Text>
        )}
      </Page>

      {/* Content page — profile + exhibit plan */}
      <Page size="LETTER" style={s.page}>
        <View style={s.draftBanner}>
          <Text style={s.draftBannerText}>Draft — For Attorney Review</Text>
        </View>

        <Text style={s.sectionHeading}>Applicant Profile Summary</Text>
        <View style={s.divider} />
        <ProfileSummary data={data} />

        {/* Verification & Provenance — the moat */}
        {verifiedClaims && Object.keys(verifiedClaims).filter(k => k !== "preliminary").length > 0 && (
          <VerificationTable trustScore={trustScore ?? 0} verifiedClaims={verifiedClaims} />
        )}

        <Text style={s.sectionHeading}>Exhibit Plan</Text>
        <View style={s.divider} />
        {data.exhibitRows.length > 0 ? (
          <ExhibitTable rows={data.exhibitRows} />
        ) : (
          <Text style={{ fontSize: 9, color: "#78716c" }}>
            Evidence collection in progress — exhibit plan will be finalized after full intake.
          </Text>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Draft — For Attorney Review</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>

      {/* Brief sections — one page per prong for clean breaks */}
      <Page size="LETTER" style={s.page} wrap>
        <View style={s.draftBanner}>
          <Text style={s.draftBannerText}>Draft — For Attorney Review</Text>
        </View>

        <BriefSection
          title="Prong 1A — Substantial Merit"
          draft={brief.substantialMerit}
        />

        <BriefSection
          title="Prong 1B — National Importance"
          draft={brief.nationalImportance}
        />

        <BriefSection
          title="Prong 3 — Waiver Justification"
          draft={brief.waiverJustification}
        />

        {(!brief.nationalImportance && !brief.waiverJustification) && (
          <View style={s.blurredNotice}>
            <Text style={s.blurredLabel}>Additional sections available after attorney claim</Text>
            <Text style={s.blurredText}>
              Full Prong 1, Prong 3, and recommendation letter drafts are available
              in the attorney workspace after claiming this lead.
            </Text>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Draft — For Attorney Review</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderDossierPdf(
  data: DossierData,
  opts?: { trustScore?: number; verifiedClaims?: Record<string, PdfClaimResult> | null },
): Promise<Buffer> {
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  // Attach formData for ProfileSummary (passed through caseData in generator)
  const docData = data as DossierData & { formData?: Record<string, unknown> };
  return renderToBuffer(
    <DossierDocument
      data={docData}
      generatedDate={generatedDate}
      trustScore={opts?.trustScore}
      verifiedClaims={opts?.verifiedClaims}
    />
  );
}

// ---------------------------------------------------------------------------
// Lead Summary PDF — lightweight PDF for leads without a full dossier.
// Renders from lead.formData (check questionnaire) instead of case data.
// ---------------------------------------------------------------------------

export type LeadSummaryInput = {
  field: string;
  tier: string;
  score: number | null;
  capturedAt: Date;
  formData: Record<string, unknown>;
  trustScore?: number;
  verifiedClaims?: Record<string, PdfClaimResult> | null;
};

function LeadSummaryDocument({ lead, generatedDate }: { lead: LeadSummaryInput; generatedDate: string }) {
  const fd = lead.formData;

  const core = [
    { label: "Degree", value: String(fd.degree ?? "—") },
    { label: "Experience", value: fd.yearsExperience ? `${fd.yearsExperience} years` : "—" },
    { label: "Publications", value: String(fd.publications ?? "—") },
    { label: "Citations", value: String(fd.citations ?? "—") },
  ].filter(c => c.value !== "—");

  const evidence = [
    { label: "Patents", value: String(fd.patents ?? "—") },
    { label: "Awards", value: String(fd.awards ?? "—") },
    { label: "Grants", value: String(fd.grants ?? "—") },
    { label: "Peer Review / Editorial", value: String(fd.peerReview ?? "—") },
    { label: "Invited Talks", value: String(fd.invitedTalks ?? "—") },
    { label: "National Importance", value: String(fd.nationalConnection ?? "—") },
    { label: "US Plan", value: String(fd.usPlan ?? "—") },
    { label: "Employer Situation", value: String(fd.employerSituation ?? "—") },
  ].filter(e => e.value !== "—");

  const gap = fd._gapNarrative as { strengths?: string; blockers?: string; legalLeverage?: string } | undefined;
  const dims = fd._dimensions as { label: string; score: number; notes?: string }[] | undefined;
  const summary = fd._summary as string | undefined;

  return (
    <Document>
      {/* Cover page */}
      <Page size="LETTER" style={s.coverPage}>
        <Text style={s.coverPlatform}>EB-2 NIW Case Assessment</Text>
        <Text style={s.coverTitle}>{lead.field} Researcher</Text>
        <Text style={s.coverSubtitle}>National Interest Waiver (I-140) — Lead Summary</Text>
        <View style={s.coverTierBadge}>
          <Text>{TIER_LABEL[lead.tier] ?? lead.tier}</Text>
        </View>
        {lead.score !== null && (
          <Text style={[s.coverMeta, { marginTop: 32 }]}>Score: {lead.score} / 100</Text>
        )}
        {(lead.trustScore ?? 0) > 0 && (
          <Text style={[s.coverMeta, { marginTop: 4 }]}>Trust Score: {lead.trustScore} / 100</Text>
        )}
        <Text style={[s.coverMeta, { marginTop: lead.score !== null ? 8 : 32 }]}>
          Generated: {generatedDate}
        </Text>
        <Text style={[s.coverMeta]}>
          Captured: {lead.capturedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </Text>
        <Text style={[s.coverDisclaimer, { marginTop: 24 }]}>
          This is a preliminary lead summary based on the applicant&apos;s self-reported check data.
          Verification performed via 10 public APIs. Full dossier generated after attorney claim.
        </Text>
      </Page>

      {/* Content page */}
      <Page size="LETTER" style={s.page}>
        {/* Profile Snapshot */}
        {core.length > 0 && (
          <View>
            <Text style={s.sectionHeading}>Profile Snapshot</Text>
            <View style={s.divider} />
            <View style={s.profileGrid}>
              {core.map(c => (
                <View key={c.label} style={s.profileCell}>
                  <Text style={s.profileLabel}>{c.label}</Text>
                  <Text style={s.profileValue}>{c.value}</Text>
                </View>
              ))}
              <View style={s.profileCell}>
                <Text style={s.profileLabel}>Assessment Tier</Text>
                <Text style={s.profileValue}>{TIER_LABEL[lead.tier] ?? lead.tier}</Text>
              </View>
              {lead.score !== null && (
                <View style={s.profileCell}>
                  <Text style={s.profileLabel}>Score</Text>
                  <Text style={s.profileValue}>{lead.score} / 100</Text>
                </View>
              )}
              {(lead.trustScore ?? 0) > 0 && (
                <View style={s.profileCell}>
                  <Text style={s.profileLabel}>Trust Score</Text>
                  <Text style={s.profileValue}>{lead.trustScore} / 100</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Verification & Provenance — the moat, Page 1 */}
        {lead.verifiedClaims && Object.keys(lead.verifiedClaims).filter(k => k !== "preliminary").length > 0 && (
          <VerificationTable trustScore={lead.trustScore ?? 0} verifiedClaims={lead.verifiedClaims} />
        )}

        {/* Detailed Evidence */}
        {evidence.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionHeading}>Detailed Evidence</Text>
            <View style={s.divider} />
            <View style={s.profileGrid}>
              {evidence.map(e => (
                <View key={e.label} style={s.profileCell}>
                  <Text style={s.profileLabel}>{e.label}</Text>
                  <Text style={s.profileValue}>{e.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* AI Assessment */}
        {(summary || gap || (dims && dims.length > 0)) && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionHeading}>AI Assessment</Text>
            <View style={s.divider} />
            {summary && (
              <Text style={s.draftParagraph}>{summary}</Text>
            )}
            {Array.isArray(dims) && dims.length > 0 && (
              <View style={[s.profileGrid, { marginTop: 8 }]}>
                {dims.map(d => (
                  <View key={d.label} style={s.profileCell}>
                    <Text style={s.profileLabel}>{d.label}</Text>
                    <Text style={s.profileValue}>{d.score} / 100</Text>
                  </View>
                ))}
              </View>
            )}
            {gap?.strengths && (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: "#15803d", marginBottom: 3 }}>STRENGTHS</Text>
                <Text style={s.draftParagraph}>{gap.strengths}</Text>
              </View>
            )}
            {gap?.blockers && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: "#b45309", marginBottom: 3 }}>BLOCKERS</Text>
                <Text style={s.draftParagraph}>{gap.blockers}</Text>
              </View>
            )}
            {gap?.legalLeverage && (
              <View style={{ marginTop: 4 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: "#1d4ed8", marginBottom: 3 }}>LEGAL LEVERAGE</Text>
                <Text style={s.draftParagraph}>{gap.legalLeverage}</Text>
              </View>
            )}
          </View>
        )}

        {/* CTA notice */}
        <View style={[s.blurredNotice, { marginTop: 24 }]}>
          <Text style={s.blurredLabel}>Full Dossier Available After Claim</Text>
          <Text style={s.blurredText}>
            The complete AI-drafted petition brief (Prong 1, Prong 2, Prong 3), exhibit plan,
            and recommendation letter drafts are generated after claiming this lead.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Lead Summary — PetitionHQ</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function renderLeadSummaryPdf(lead: LeadSummaryInput): Promise<Buffer> {
  const generatedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  return renderToBuffer(<LeadSummaryDocument lead={lead} generatedDate={generatedDate} />);
}
