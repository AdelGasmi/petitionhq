/**
 * Form registry.
 *
 * Every new form added to the platform MUST be registered here. The UI,
 * dashboard, and routing all iterate through this registry — add a form once,
 * it shows up everywhere.
 */

import type { FormConfig } from "./types";
import { i140Niw } from "./i140-niw";
import { n400 } from "./n400";
import { i130F2A } from "./i130-f2a";
import { i485 } from "./i485";
import { i765 } from "./i765";
import { i131 } from "./i131";

export const FORMS: Record<string, FormConfig> = {
  [i140Niw.id]: i140Niw,
  [i485.id]: i485,
  [i765.id]: i765,
  [i131.id]: i131,
  [i130F2A.id]: i130F2A,
  [n400.id]: n400,
};

// i765/i131 are I-485 companion forms — kept in registry for existing cases,
// hidden from standalone new-case creation.
const HIDDEN_FORMS = new Set(["i765", "i131"]);
export const FORM_LIST: FormConfig[] = Object.values(FORMS).filter((f) => !HIDDEN_FORMS.has(f.id));

export function getForm(id: string): FormConfig | undefined {
  return FORMS[id];
}

export function formsByCategory() {
  const map: Record<string, FormConfig[]> = {};
  for (const f of FORM_LIST) {
    map[f.category] ??= [];
    map[f.category].push(f);
  }
  return map;
}
