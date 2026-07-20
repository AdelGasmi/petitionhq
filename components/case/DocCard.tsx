"use client";

import { useState, useRef } from "react";
import type { DocumentRequirement } from "@/forms/types";
import { Download } from "@/components/icons";

export type DocCardState = {
  status: string;
  notes: string;
  filename?: string;
  size?: number;
  mimeType?: string;
};

function formatBytes(n?: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocCard({
  caseId,
  doc,
  state,
  onChange,
  onUploaded,
}: {
  caseId: string;
  doc: DocumentRequirement;
  state: DocCardState;
  onChange: (patch: Record<string, unknown>) => void;
  onUploaded: (patch: Partial<DocCardState>) => void;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState(state.notes);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/cases/${caseId}/documents/${doc.id}/upload`,
        { method: "POST", body: fd }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Upload failed (${res.status})`);
      }
      onUploaded({
        status: "uploaded",
        filename: data.filename,
        size: data.size,
        mimeType: data.mimeType,
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async () => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(
        `/api/cases/${caseId}/documents/${doc.id}/upload`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      onUploaded({
        status: "missing",
        filename: undefined,
        size: undefined,
        mimeType: undefined,
      });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const fileUrl = `/api/cases/${caseId}/documents/${doc.id}/file`;
  const hasFile = !!state.filename;

  return (
    <div className="card space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{doc.title}</span>
            {!doc.required && (
              <span className="text-xs text-text-muted">optional</span>
            )}
          </div>
          <p className="mt-1 text-xs text-text-secondary">{doc.description}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            state.status === "uploaded"
              ? "bg-success-soft text-success-text"
              : "bg-surface-muted text-text-muted"
          }`}
        >
          {state.status === "uploaded" ? "Have it" : "Missing"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt,application/pdf,image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <button
          type="button"
          className="btn btn-secondary text-xs"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading
            ? "Uploading..."
            : hasFile
            ? "Replace file"
            : "Upload file"}
        </button>
        {hasFile && (
          <>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-text-secondary underline hover:text-text-primary"
            >
              View {state.filename}
            </a>
            <a
              href={`${fileUrl}?download=1`}
              className="inline-flex items-center gap-1 text-xs text-text-secondary underline hover:text-text-primary"
            >
              <Download className="h-3 w-3" />
              Download
            </a>
            <span className="text-xs text-text-muted">
              {formatBytes(state.size)}
            </span>
            <button
              type="button"
              className="text-xs text-danger-fill hover:text-danger-text"
              onClick={removeFile}
              disabled={uploading}
            >
              Remove
            </button>
          </>
        )}
        {!hasFile && (
          <label className="flex items-center gap-1.5 text-xs text-text-muted">
            <input
              type="checkbox"
              checked={state.status === "uploaded"}
              onChange={(e) =>
                onChange({
                  status: e.target.checked ? "uploaded" : "missing",
                })
              }
            />
            Mark as have-it (without upload)
          </label>
        )}
      </div>
      {uploadError && (
        <p className="text-xs text-danger-fill">{uploadError}</p>
      )}

      <div>
        <button
          type="button"
          className="text-xs text-text-muted hover:text-text-primary"
          onClick={() => setShowNotes((v) => !v)}
        >
          {showNotes ? "Hide notes" : "Add notes"}
        </button>
        {showNotes && (
          <textarea
            className="input mt-2 text-xs"
            rows={2}
            placeholder="Notes or pasted text..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onChange({ notes })}
          />
        )}
      </div>
    </div>
  );
}
