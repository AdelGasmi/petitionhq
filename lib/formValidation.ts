import type { FormConfig, FormField } from "@/forms/types";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  section: string;
  sectionId: string;
  fieldId: string;
  label: string;
  severity: ValidationSeverity;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  /** Issues keyed by sectionId for badge display */
  bySectionId: Record<string, ValidationIssue[]>;
};

// ─── Field-level validators ───────────────────────────────────────────────────

const ALIEN_NUMBER_RE = /^A-?\d{8,9}$/;
const SSN_RE = /^\d{3}-\d{2}-\d{4}$/;
const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateFieldValue(
  field: FormField,
  value: unknown,
  sectionTitle: string
): ValidationIssue | null {
  const { id, label, required } = field;
  const isEmpty = value === null || value === undefined || value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (required && isEmpty) {
    return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label} is required.` };
  }
  if (isEmpty) return null;

  const str = String(value);

  if (field.type === "alienNumber") {
    if (!ALIEN_NUMBER_RE.test(str)) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: invalid alien number format (A-XXXXXXXX).` };
    }
  }
  if (field.type === "ssn") {
    if (!SSN_RE.test(str)) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: invalid SSN format (XXX-XX-XXXX).` };
    }
  }
  if (field.type === "phone") {
    if (!PHONE_RE.test(str)) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "warning", message: `${label}: phone number may be invalid.` };
    }
  }
  if (field.type === "email") {
    if (!EMAIL_RE.test(str)) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: invalid email address.` };
    }
  }
  if (field.type === "text" && field.pattern) {
    const re = new RegExp(field.pattern);
    if (!re.test(str)) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: format is invalid.` };
    }
  }
  if (field.type === "number") {
    const n = Number(value);
    if (isNaN(n)) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: must be a number.` };
    }
    if (field.min !== undefined && n < field.min) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: minimum value is ${field.min}.` };
    }
    if (field.max !== undefined && n > field.max) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: "error", message: `${label}: maximum value is ${field.max}.` };
    }
  }
  if (field.type === "repeatable") {
    const items = Array.isArray(value) ? value : [];
    if (field.minItems !== undefined && items.length < field.minItems) {
      return { section: sectionTitle, sectionId: "", fieldId: id, label, severity: field.required ? "error" : "warning", message: `${label}: at least ${field.minItems} item${field.minItems > 1 ? "s" : ""} required.` };
    }
  }
  return null;
}

// ─── Main validator ───────────────────────────────────────────────────────────

export function validateFormData(
  form: FormConfig,
  data: Record<string, unknown>
): ValidationResult {
  const issues: ValidationIssue[] = [];

  for (const section of form.sections) {
    const sectionData = (data[section.id] ?? {}) as Record<string, unknown>;

    for (const field of section.fields) {
      const value = sectionData[field.id];
      const issue = validateFieldValue(field, value, section.title);
      if (issue) {
        issues.push({ ...issue, sectionId: section.id });
      }

      // Recurse into repeatable items
      if (field.type === "repeatable" && Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          const item = (value[i] ?? {}) as Record<string, unknown>;
          for (const subField of field.fields) {
            const subIssue = validateFieldValue(subField, item[subField.id], section.title);
            if (subIssue) {
              issues.push({
                ...subIssue,
                sectionId: section.id,
                fieldId: `${field.id}[${i}].${subField.id}`,
                label: `${field.label} #${i + 1} — ${subField.label}`,
              });
            }
          }
        }
      }
    }
  }

  const bySectionId: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    (bySectionId[issue.sectionId] ??= []).push(issue);
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    issues,
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
    bySectionId,
  };
}
