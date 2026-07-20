import { type PdfFieldMap } from "./engine";
import { i140Map } from "./maps/i140";
import { i485Map } from "./maps/i485";
import { i765Map } from "./maps/i765";
import { i131Map } from "./maps/i131";
import { n400Map } from "./maps/n400";
import { i130Map } from "./maps/i130";

const maps: PdfFieldMap[] = [i140Map, i485Map, i765Map, i131Map, n400Map, i130Map];

export function getFieldMap(formId: string): PdfFieldMap | undefined {
  return maps.find((m) => m.formId === formId);
}

export { fillPdf } from "./engine";
