import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
  convertInchesToTwip,
} from "docx";
import type { DossierData } from "./dossierGenerator";
import type { ExhibitRow } from "./exhibitPlan";

/**
 * Renders the AI-drafted petition brief as an editable .docx — the attorney's
 * working draft. Mirrors `letterDocx.ts` styling (Times New Roman, 1" margins).
 *
 * Structure intentionally mirrors the dossier PDF (`dossierPdf.tsx`):
 *   Prong 1A — Substantial Merit
 *   Prong 1B — National Importance
 *   Prong 3 — Waiver Justification
 *   Exhibit Plan (Prong / Item / Description table)
 *
 * Access is enforced upstream by the route (BOLA-gated to the claiming attorney);
 * this function is pure formatting and assumes the caller is authorized.
 */

/** Split a draft string into paragraphs, preserving single newlines as soft breaks. */
function bodyParagraphs(text: string): Paragraph[] {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return [
      new Paragraph({
        children: [
          new TextRun({ text: "[Section not yet drafted]", italics: true, color: "888888" }),
        ],
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
        alignment: AlignmentType.JUSTIFIED,
      })
  );
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: "dddddd", space: 2 } },
    children: [new TextRun({ text, bold: true, size: 26 })],
  });
}

function exhibitTable(rows: ExhibitRow[]): Table {
  const headerCell = (t: string) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 18 })] })],
    });
  const cell = (t: string) =>
    new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: t || "—", size: 18 })] })],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [
      convertInchesToTwip(0.9),
      convertInchesToTwip(1.9),
      convertInchesToTwip(3.6),
    ],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [headerCell("Prong"), headerCell("Item"), headerCell("Description")],
      }),
      ...rows.map(
        (r) =>
          new TableRow({
            children: [cell(r.prong), cell(r.item), cell(r.description)],
          })
      ),
    ],
  });
}

export async function generateBriefDocx(data: DossierData): Promise<Buffer> {
  const applicant =
    (data.applicantName && data.applicantName.trim()) || `${data.field} Researcher`;
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const header: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "EB-2 National Interest Waiver", bold: true, size: 32 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Petition Brief (I-140) — Analysis", size: 22, color: "444444" }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: applicant, bold: true, size: 24 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: [data.field, today].filter(Boolean).join("  ·  "),
          size: 20,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "cccccc", space: 4 } },
      spacing: { after: 280 },
      children: [],
    }),
  ];

  const prongs: Paragraph[] = [
    sectionHeading("Prong 1A — Substantial Merit"),
    ...bodyParagraphs(data.brief.substantialMerit),
    sectionHeading("Prong 1B — National Importance"),
    ...bodyParagraphs(data.brief.nationalImportance),
    sectionHeading("Prong 3 — Waiver Justification"),
    ...bodyParagraphs(data.brief.waiverJustification),
  ];

  const exhibitSection: (Paragraph | Table)[] = [
    sectionHeading("Exhibit Plan"),
    data.exhibitRows.length > 0
      ? exhibitTable(data.exhibitRows)
      : new Paragraph({
          children: [
            new TextRun({
              text: "Evidence collection in progress — exhibit plan will be finalized after full intake.",
              italics: true,
              color: "888888",
            }),
          ],
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
        children: [...header, ...prongs, ...exhibitSection],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
