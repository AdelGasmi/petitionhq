import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { LetterRecord } from "./db";

const FONT_SIZE = 11;
const LINE = 1.55;

const styles = StyleSheet.create({
  page: {
    fontFamily: "Times-Roman",
    fontSize: FONT_SIZE,
    lineHeight: LINE,
    paddingTop: 72,
    paddingBottom: 72,
    paddingHorizontal: 80,
    color: "#111",
  },
  header: {
    marginBottom: 28,
  },
  senderName: {
    fontSize: 13,
    fontFamily: "Times-Bold",
    marginBottom: 2,
  },
  senderMeta: {
    fontSize: 10,
    color: "#444",
    marginBottom: 1,
  },
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#bbb",
    marginBottom: 18,
    marginTop: 10,
  },
  date: {
    marginBottom: 18,
    color: "#333",
  },
  reLabel: {
    fontFamily: "Times-Bold",
    marginBottom: 12,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: "justify",
  },
  closing: {
    marginTop: 24,
  },
  signature: {
    marginTop: 36,
  },
  sigName: {
    fontFamily: "Times-Bold",
    fontSize: 11,
  },
  sigMeta: {
    fontSize: 10,
    color: "#333",
    marginTop: 2,
  },
  petitionHeader: {
    fontFamily: "Times-Bold",
    fontSize: 13,
    marginBottom: 4,
  },
  petitionSub: {
    fontSize: 10,
    color: "#444",
    marginBottom: 20,
  },
});

function formatDate() {
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function Paragraphs({ text }: { text: string }) {
  const paras = text.split(/\n\n+/).filter(Boolean);
  return (
    <>
      {paras.map((p, i) => (
        <Text key={i} style={styles.paragraph}>
          {p.replace(/\n/g, " ")}
        </Text>
      ))}
    </>
  );
}

function RecommendationLetter({
  letter,
  applicantName,
}: {
  letter: LetterRecord;
  applicantName: string;
}) {
  const rec = letter.recommender;
  const draft = letter.currentDraft ?? "";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Sender header */}
        <View style={styles.header}>
          {rec.name ? <Text style={styles.senderName}>{rec.name}</Text> : null}
          {rec.title ? <Text style={styles.senderMeta}>{rec.title}</Text> : null}
          {rec.institution ? <Text style={styles.senderMeta}>{rec.institution}</Text> : null}
        </View>

        <View style={styles.divider} />

        <Text style={styles.date}>{formatDate()}</Text>

        <Text style={styles.reLabel}>
          Re: Letter of Recommendation for {applicantName}
        </Text>

        <Text style={[styles.paragraph, { marginBottom: 16 }]}>Dear USCIS Officer,</Text>

        <Paragraphs text={draft} />

        <View style={styles.closing}>
          <Text style={styles.paragraph}>Sincerely,</Text>
        </View>

        <View style={styles.signature}>
          {rec.name ? <Text style={styles.sigName}>{rec.name}</Text> : null}
          {rec.title ? <Text style={styles.sigMeta}>{rec.title}</Text> : null}
          {rec.institution ? <Text style={styles.sigMeta}>{rec.institution}</Text> : null}
        </View>
      </Page>
    </Document>
  );
}

function PetitionLetter({
  letter,
  petitionerName,
  caseTitle,
}: {
  letter: LetterRecord;
  petitionerName: string;
  caseTitle: string;
}) {
  const draft = letter.currentDraft ?? "";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.petitionHeader}>{caseTitle}</Text>
        <Text style={styles.petitionSub}>
          Form I-140 — National Interest Waiver Petition for {petitionerName}
        </Text>
        <Text style={styles.date}>{formatDate()}</Text>

        <View style={styles.divider} />

        <Text style={{ ...styles.paragraph, marginBottom: 20 }}>
          To the USCIS Adjudicating Officer:
        </Text>

        <Paragraphs text={draft} />

        <View style={styles.closing}>
          <Text style={styles.paragraph}>Respectfully submitted,</Text>
        </View>
        <View style={styles.signature}>
          <Text style={styles.sigName}>{petitionerName}</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateLetterPdf(
  letter: LetterRecord,
  opts: {
    isPetition: boolean;
    applicantName: string;
    caseTitle: string;
  }
): Promise<Buffer> {
  const element = opts.isPetition ? (
    <PetitionLetter
      letter={letter}
      petitionerName={opts.applicantName}
      caseTitle={opts.caseTitle}
    />
  ) : (
    <RecommendationLetter letter={letter} applicantName={opts.applicantName} />
  );

  const buffer = await renderToBuffer(element);
  return Buffer.from(buffer);
}
