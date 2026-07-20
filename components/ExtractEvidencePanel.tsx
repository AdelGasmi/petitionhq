"use client";

import { useState, useRef } from "react";
import type { ExtractedEvidence } from "@/app/api/cases/[id]/extract-evidence/route";

type Props = {
  caseId: string;
  onMerged?: () => void;
};

type UploadMode = "file" | "paste";

function Badge({ count, label }: { count: number; label: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-center ${count > 0 ? "border-green-200 bg-green-50" : "border-stone-200 bg-stone-50"}`}>
      <p className={`text-xl font-bold ${count > 0 ? "text-green-800" : "text-stone-300"}`}>{count}</p>
      <p className="text-xs text-stone-500">{label}</p>
    </div>
  );
}

export function ExtractEvidencePanel({ caseId, onMerged }: Props) {
  const [mode, setMode] = useState<UploadMode>("file");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExtractedEvidence | null>(null);
  const [merged, setMerged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const extract = async (e: React.FormEvent) => {
    e.preventDefault();
    setExtracting(true);
    setError("");
    setResult(null);

    try {
      let res: Response;
      if (mode === "file") {
        const file = fileRef.current?.files?.[0];
        if (!file) { setError("Select a file first."); setExtracting(false); return; }
        const fd = new FormData();
        fd.append("file", file);
        res = await fetch(`/api/cases/${caseId}/extract-evidence`, { method: "POST", body: fd });
      } else {
        if (!pastedText.trim()) { setError("Paste your CV text first."); setExtracting(false); return; }
        res = await fetch(`/api/cases/${caseId}/extract-evidence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pastedText }),
        });
      }

      const data = await res.json() as ExtractedEvidence & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  const merge = async () => {
    if (!result) return;
    setMerging(true);
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/extract-evidence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extracted: result }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setMerged(true);
      onMerged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setMerging(false);
    }
  };

  if (merged) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 px-5 py-4 flex items-center gap-3">
        <span className="text-xl">✓</span>
        <div>
          <p className="text-sm font-semibold text-green-800">Evidence imported successfully</p>
          <p className="text-xs text-green-700">Go to "Update profile" to review and edit the imported data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-surface-card px-5 py-5 space-y-5">
      <div>
        <h3 className="font-serif text-lg">Extract from CV</h3>
        <p className="mt-0.5 text-sm text-stone-500">
          Upload your CV (PDF) or paste the text — we'll extract your publications, awards, grants, and more automatically.
        </p>
      </div>

      {!result && (
        <form onSubmit={extract} className="space-y-4">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-stone-200 overflow-hidden w-fit">
            {(["file", "paste"] as UploadMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${mode === m ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"}`}
              >
                {m === "file" ? "Upload PDF" : "Paste text"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div
              className={`rounded-lg border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${selectedFileName ? "border-green-300 bg-green-50" : "border-stone-200 hover:border-stone-400"}`}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  setSelectedFileName(f?.name ?? null);
                  setError("");
                }}
              />
              {selectedFileName ? (
                <>
                  <p className="text-sm font-medium text-green-800">{selectedFileName}</p>
                  <p className="text-xs text-green-600 mt-1">Ready — click "Extract evidence" below</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-stone-500">Click to select your CV (PDF, TXT)</p>
                  <p className="text-xs text-stone-400 mt-1">Max 10 MB</p>
                </>
              )}
            </div>
          ) : (
            <textarea
              className="input min-h-[180px] text-sm font-mono leading-relaxed"
              placeholder="Paste your full CV text here — including publications list, awards, grants, and editorial roles…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn btn-primary text-sm" disabled={extracting}>
            {extracting ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-surface-card" />
                Extracting…
              </span>
            ) : "Extract evidence"}
          </button>
        </form>
      )}

      {result && (
        <div className="space-y-5">
          {/* Confidence */}
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            result.confidence === "high" ? "bg-green-50 text-green-800"
            : result.confidence === "medium" ? "bg-amber-50 text-amber-800"
            : "bg-red-50 text-red-800"
          }`}>
            <span className="font-semibold capitalize">{result.confidence} confidence</span>
            {result.notes && <span className="text-xs opacity-80">— {result.notes}</span>}
          </div>

          {/* Degree */}
          {result.degree && (
            <div className="rounded-lg border border-stone-100 bg-stone-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1">Degree found</p>
              <p className="text-sm text-stone-800">
                {result.degree.level} in {result.degree.field}, {result.degree.institution}
                {result.degree.year ? ` (${result.degree.year})` : ""}
              </p>
            </div>
          )}

          {/* Counts */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            <Badge count={result.publications.length} label="Publications" />
            <Badge count={result.awards.length} label="Awards" />
            <Badge count={result.grants.length} label="Grants" />
            <Badge count={result.editorialRoles.length} label="Editorial" />
            <Badge count={result.invitedTalks.length} label="Talks" />
            <Badge count={result.patents.length} label="Patents" />
          </div>

          {/* Publication preview */}
          {result.publications.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">Publications found</p>
              {result.publications.map((p, i) => (
                <div key={i} className="flex items-start justify-between gap-3 rounded px-2 py-1.5 hover:bg-stone-50">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-800 truncate">{p.title}</p>
                    <p className="text-xs text-stone-400">{[p.venue, p.year].filter(Boolean).join(" · ")}</p>
                  </div>
                  {p.citations != null && (
                    <span className="shrink-0 text-xs text-stone-400">{p.citations} cit.</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="button" className="btn btn-primary text-sm" onClick={merge} disabled={merging}>
              {merging ? "Saving…" : "Add to my profile →"}
            </button>
            <button type="button" className="text-sm text-stone-400 hover:text-stone-700" onClick={() => { setResult(null); setSelectedFileName(null); }}>
              Try again
            </button>
          </div>
          <p className="text-xs text-stone-400">
            Existing evidence is preserved — extracted items are added on top. Review everything in "Update profile" after importing.
          </p>
        </div>
      )}
    </div>
  );
}
