import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
} from "docx";
import type { LetterRecord } from "./db";

function paragraphsFromText(text: string): Paragraph[] {
  return text.split(/\n\n+/).map(
    (block) =>
      new Paragraph({
        children: block.split("\n").flatMap((line, i, arr) => [
          new TextRun({ text: line }),
          ...(i < arr.length - 1 ? [new TextRun({ break: 1 })] : []),
        ]),
        spacing: { after: 160 },
      })
  );
}

export async function generateLetterDocx(
  letter: LetterRecord,
  opts: { applicantName: string; caseTitle: string }
): Promise<Buffer> {
  const rec = letter.recommender;
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const headerLines: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: rec.name, bold: true, size: 28 })],
    }),
    ...(rec.title
      ? [new Paragraph({ children: [new TextRun({ text: rec.title, size: 22, color: "444444" })] })]
      : []),
    ...(rec.institution
      ? [new Paragraph({ children: [new TextRun({ text: rec.institution, size: 22, color: "444444" })] })]
      : []),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "cccccc", space: 4 } },
      spacing: { after: 240 },
      children: [],
    }),
    new Paragraph({
      children: [new TextRun({ text: today })],
      spacing: { after: 320 },
    }),
  ];

  const bodyParagraphs = letter.currentDraft
    ? paragraphsFromText(letter.currentDraft)
    : [
        new Paragraph({
          children: [new TextRun({ text: "[No draft available]", italics: true, color: "888888" })],
        }),
      ];

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 22 },
          paragraph: { spacing: { line: 360 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.1),
              right: convertInchesToTwip(1.1),
            },
          },
        },
        children: [...headerLines, ...bodyParagraphs],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
