/**
 * Petition-brief export — read-only .pdf of the case-workspace brief.
 *
 * Sibling to `petitionBriefDocx.ts`. Renders the section-by-section brief the
 * attorney assembles in `PetitionBriefEditor` (`formData.narrativeDrafts`).
 * Mirrors `letterPdf.tsx` styling (Times-Roman, justified body) and is
 * deliberately **white-label** — the only footer content is the page number, no
 * PetitionHQ mark on the attorney's filed work product.
 */
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type BriefSection = { heading: string; body: string };

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: 11,
    lineHeight: 1.55,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 80,
    color: "#111",
  },
  title: { fontFamily: "Times-Bold", fontSize: 15, textAlign: "center", marginBottom: 4 },
  sub: { fontSize: 10, color: "#444", textAlign: "center", marginBottom: 4 },
  date: { fontSize: 10, color: "#666", textAlign: "center", marginBottom: 16 },
  divider: { borderBottomWidth: 0.5, borderBottomColor: "#bbb", marginBottom: 18 },
  heading: { fontFamily: "Times-Bold", fontSize: 12, marginTop: 16, marginBottom: 8 },
  paragraph: { marginBottom: 12, textAlign: "justify" },
  empty: { marginBottom: 12, color: "#888", fontStyle: "italic" },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 80,
    right: 80,
    textAlign: "right",
    fontSize: 9,
    color: "#999",
  },
});

function formatDate() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function Body({ text }: { text: string }) {
  const t = (text ?? "").trim();
  if (!t) return <Text style={styles.empty}>[Section not yet drafted]</Text>;
  return (
    <>
      {t.split(/\n\n+/).filter(Boolean).map((p, i) => (
        <Text key={i} style={styles.paragraph}>
          {p.replace(/\n/g, " ")}
        </Text>
      ))}
    </>
  );
}

function Brief({
  sections,
  title,
  petitionerName,
}: {
  sections: BriefSection[];
  title: string;
  petitionerName: string;
}) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          Form I-140 — National Interest Waiver Petition for {petitionerName}
        </Text>
        <Text style={styles.date}>{formatDate()}</Text>
        <View style={styles.divider} />
        {sections.map((sec, i) => (
          <View key={i}>
            <Text style={styles.heading}>{sec.heading}</Text>
            <Body text={sec.body} />
          </View>
        ))}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </Page>
    </Document>
  );
}

export async function generatePetitionBriefPdf(
  sections: BriefSection[],
  opts: { title: string; petitionerName: string }
): Promise<Buffer> {
  const buffer = await renderToBuffer(
    <Brief sections={sections} title={opts.title} petitionerName={opts.petitionerName} />
  );
  return Buffer.from(buffer);
}
