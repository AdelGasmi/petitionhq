"use client";

import type { FormField, RepeatableField } from "@/forms/types";

export function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

export function renderInput(
  field: FormField,
  value: unknown,
  onChange: (v: unknown) => void
): React.ReactNode {
  const strVal = String(value ?? "");

  if (field.type === "textarea") {
    return (
      <textarea
        className="input"
        rows={4}
        value={strVal}
        maxLength={(field as { maxLength?: number }).maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select className="select" value={strVal} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {field.options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "date") {
    return (
      <input
        type="date"
        className="input"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  if (field.type === "number") {
    return (
      <input
        type="number"
        className="input"
        value={strVal}
        min={field.min}
        max={field.max}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    );
  }
  if (field.type === "address") {
    const addr = (value as Record<string, string>) ?? {};
    const update = (k: string, v: string) => onChange({ ...addr, [k]: v });
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className="input sm:col-span-2"
          placeholder="Street address"
          value={addr.street ?? ""}
          onChange={(e) => update("street", e.target.value)}
        />
        <input
          className="input"
          placeholder="City"
          value={addr.city ?? ""}
          onChange={(e) => update("city", e.target.value)}
        />
        <input
          className="input"
          placeholder="State"
          value={addr.state ?? ""}
          onChange={(e) => update("state", e.target.value)}
        />
        <input
          className="input"
          placeholder="Postal code"
          value={addr.postalCode ?? ""}
          onChange={(e) => update("postalCode", e.target.value)}
        />
        <input
          className="input"
          placeholder="Country"
          value={addr.country ?? ""}
          onChange={(e) => update("country", e.target.value)}
        />
      </div>
    );
  }
  if (field.type === "repeatable") {
    const items = (value as Record<string, unknown>[]) ?? [];
    return (
      <RepeatableEditor
        field={field as RepeatableField}
        items={items}
        onChange={onChange}
      />
    );
  }
  // text | email | phone | ssn | alienNumber
  const inputType =
    field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text";
  return (
    <input
      type={inputType}
      className="input"
      value={strVal}
      maxLength={(field as { maxLength?: number }).maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function RepeatableEditor({
  field,
  items,
  onChange,
}: {
  field: RepeatableField;
  items: Record<string, unknown>[];
  onChange: (v: unknown) => void;
}) {
  const add = () => onChange([...items, {}]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, subId: string, v: unknown) => {
    onChange(items.map((item, idx) => (idx === i ? { ...item, [subId]: v } : item)));
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="relative rounded-lg border border-border-default p-4">
          <button
            type="button"
            className="absolute right-2 top-2 text-xs text-text-muted hover:text-text-primary"
            onClick={() => remove(i)}
          >
            ✕
          </button>
          <div className="space-y-3 pr-6">
            {field.fields.map((sub) => (
              <div key={sub.id}>
                <label className="block text-xs font-medium text-text-secondary">
                  {sub.label}
                </label>
                <div className="mt-1">
                  {renderInput(sub, item[sub.id], (v) => updateItem(i, sub.id, v))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-secondary text-xs" onClick={add}>
        + Add {field.itemLabel}
      </button>
    </div>
  );
}

export function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-text-secondary">
        {field.label}
        {field.required && isEmpty(value) && (
          <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-danger-fill" />
        )}
      </label>
      {field.help && (
        <p className="mt-0.5 text-xs text-text-muted">{field.help}</p>
      )}
      <div className="mt-1">{renderInput(field, value, onChange)}</div>
    </div>
  );
}
