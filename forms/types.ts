/**
 * Form engine — shared types for every USCIS form.
 * Add a form = add a file, register in index.ts. No UI changes needed.
 */

export type FormConfig = {
  id: string;
  formNumber: string;
  title: string;
  shortTitle: string;
  description: string;
  category: FormCategory;
  filingFee: FeeInfo;
  processing: ProcessingInfo;
  eligibility: EligibilityRule[];
  sections: FormSection[];
  documents: DocumentRequirement[];
  letters: LetterRequirement[];
  narratives?: NarrativeRequirement[];
  advisories?: string[];
};

export type FormCategory =
  | "employment-based"
  | "family-based"
  | "naturalization"
  | "nonimmigrant"
  | "adjustment";

export type FeeInfo = {
  uscisFee: number;
  biometricsFee?: number;
  premiumProcessingFee?: number;
  notes?: string;
};

export type ProcessingInfo = {
  serviceCenters: string[];
  medianMonths: number;
  premiumEligible: boolean;
  premiumDays?: number;
};

export type EligibilityRule = {
  id: string;
  label: string;
  explanation: string;
  severity: "must" | "should";
  framework?: { name: string; prong?: string };
};

export type FormSection = {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
};

export type FormField =
  | TextField
  | SelectField
  | DateField
  | NumberField
  | AddressField
  | RepeatableField;

type FieldBase = {
  id: string;
  label: string;
  help?: string;
  required?: boolean;
  uscisRef?: string;
};

export type TextField = FieldBase & {
  type: "text" | "textarea" | "email" | "phone" | "ssn" | "alienNumber";
  maxLength?: number;
  pattern?: string;
};

export type SelectField = FieldBase & {
  type: "select";
  options: { value: string; label: string }[];
};

export type DateField = FieldBase & {
  type: "date";
  minDate?: string;
  maxDate?: string;
};

export type NumberField = FieldBase & {
  type: "number";
  min?: number;
  max?: number;
};

export type AddressField = FieldBase & {
  type: "address";
  international?: boolean;
};

export type RepeatableField = FieldBase & {
  type: "repeatable";
  itemLabel: string;
  fields: FormField[];
  minItems?: number;
  maxItems?: number;
};

export type DocumentRequirement = {
  id: string;
  title: string;
  description: string;
  required: boolean;
  supports?: string[];
  prong?: string;
  accept?: string[];
  extractable?: boolean;
  validation?: { kind: string; detail: string }[];
};

export type LetterRequirement = {
  id: string;
  title: string;
  kind: LetterKind;
  description: string;
  required: boolean;
  minCount?: number;
  maxCount?: number;
  /** Optional schema for collecting recommender info — currently advisory only. */
  recommenderProfile?: FormField[];
  draftingHints?: {
    targetLength?: { minWords: number; maxWords: number };
    mustAddress?: string[];
    tone?: "academic" | "professional" | "personal";
    framework?: string;
  };
};

export type LetterKind =
  | "recommendation-independent"
  | "recommendation-dependent"
  | "employer-support"
  | "affidavit"
  | "petition-letter";

export type NarrativeRequirement = {
  id: string;
  title: string;
  description: string;
  outline: {
    id: string;
    heading: string;
    guidance: string;
    /** Optional cross-references to documents that support this outline section. */
    evidenceRefs?: string[];
  }[];
  targetLength: { minWords: number; maxWords: number };
};
