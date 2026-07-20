// Usage: node scripts/inspect-pdf.mjs public/pdf-templates/i-485.pdf
import { readFile } from "fs/promises";
import { PDFDocument } from "pdf-lib";

const [, , filePath] = process.argv;
if (!filePath) { console.error("Usage: node inspect-pdf.mjs <path>"); process.exit(1); }

const bytes = await readFile(filePath);
const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
const form = doc.getForm();
const fields = form.getFields();

console.log(`\n=== ${filePath} — ${fields.length} fields ===\n`);
for (const f of fields) {
  const type = f.constructor.name.replace("PDF", "").replace("Field", "");
  const name = f.getName();
  let extra = "";
  try {
    if (type === "TextField") {
      const tf = f;
      extra = `  [maxLen=${tf.getMaxLength() ?? "∞"}, multiline=${tf.isMultiline()}]`;
    } else if (type === "CheckBox") {
      extra = `  [checked=${f.isChecked()}]`;
    } else if (type === "RadioGroup") {
      extra = `  [options=${f.getOptions().join("|")}]`;
    } else if (type === "Dropdown") {
      extra = `  [options=${f.getOptions().slice(0,5).join("|")}${f.getOptions().length>5?"…":""}]`;
    }
  } catch {}
  console.log(`  ${type.padEnd(12)} "${name}"${extra}`);
}
