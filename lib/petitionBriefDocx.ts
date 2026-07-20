/**
 * Petition-brief export — editable .docx of the case-workspace brief.
 *
 * This is the brief the attorney assembles section-by-section in
 * `PetitionBriefEditor` (`Case.formData.narrativeDrafts[narrativeId]`), NOT the
 * pre-claim lead dossier (`lib/briefDocx.ts`, built from `DossierData`). Mirrors
 * `letterDocx.ts` styling (Times New Roman, 1" margins) and is deliberately
 * **white-label** — no PetitionHQ mark on the attorney's filed work product.
 *
 * Access is enforced upstream by the route (session + canAccessCase); this is
 * pure formatting and assumes the caller is authorized.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  convertInchesToTwip,
} from "docx";

export type BriefSection = { heading: string; body: string };

function paragraphsFromText(text: string): Paragraph[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return [
      new Paragraph({
        children: [new TextRun({ text: "[Section not yet drafted]", italics: true, color: "888888" })],
        spacing: { after: 160 },
      }),
    ];
  }
  return trimmed.split(/\n\n+/).map(
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

export async function generatePetitionBriefDocx(
  sections: BriefSection[],
  opts: { title: string; petitionerName: string }
): Promise<Buffer> {
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const header: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: opts.title, bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Form I-140 — National Interest Waiver Petition for ${opts.petitionerName}`,
          size: 22,
          color: "444444",
        }),
      ],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: today, size: 20, color: "666666" })],
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "cccccc", space: 8 } },
      spacing: { after: 280 },
    }),
  ];

  const body = sections.flatMap((sec) => [
    new Paragraph({
      children: [new TextRun({ text: sec.heading, bold: true, size: 24 })],
      spacing: { before: 240, after: 120 },
    }),
    ...paragraphsFromText(sec.body),
  ]);

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
        children: [...header, ...body],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
