"use client";

/**
 * InsightsPanel — collapsible right-hand drawer for the letter/brief editor.
 *
 * Tabs:
 *  • Versions  — full version history with view/compare/restore
 *  • Coherence — CoherenceBlock (moved here from below the letter)
 *  • Ledger    — neutral evidence ledger facts (Sprint 1)
 */

import { useState } from "react";
import type { LetterVersion } from "@/lib/db";
import type { NarrativeRequirement } from "@/forms/types";
import type { EvidenceLedger } from "@/lib/evidenceLedger";
import { CoherenceBlock } from "@/components/PetitionBriefEditor";
import type { CoherenceReport } from "@/app/api/cases/[id]/brief/[narrativeId]/coherence/route";
import { settingsHeaders } from "@/lib/settings";

type Tab = "versions" | "coherence" | "ledger";

type Props = {
  /* --- shared --- */
  caseId: string;
  isPetition: boolean;

  /* --- versions tab --- */
  versions: LetterVersion[];
  currentDraft: string;
  viewingVersion: string | null;
  setViewingVersion: (id: string | null) => void;
  comparingVersion: string | null;
  setComparingVersion: (id: string | null) => void;
  onRestoreVersion: (v: LetterVersion) => void;

  /* --- coherence tab (petition only) --- */
  narrativeId?: string;
  outline?: NarrativeRequirement["outline"];
  draftedCount?: number;
  totalSections?: number;
  initialCoherence?: CoherenceReport;
  onJumpToSection?: (sectionId: string) => void;

  /* --- ledger tab (petition only) --- */
  evidenceLedger?: EvidenceLedger | null;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function InsightsPanel({
  caseId, isPetition,
  versions, currentDraft, viewingVersion, setViewingVersion, comparingVersion, setComparingVersion, onRestoreVersion,
  narrativeId, outline, draftedCount = 0, totalSections = 0, initialCoherence, onJumpToSection,
  evidenceLedger,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("versions");
  const [showAllVersions, setShowAllVersions] = useState(false);

  const tabs: Array<{ id: Tab; label: string; show: boolean }> = [
    { id: "versions", label: "Versions", show: true },
    { id: "coherence", label: "Coherence", show: isPetition && !!narrativeId },
    { id: "ledger", label: "Ledger", show: isPetition && !!evidenceLedger },
  ];

  return (
    <div className="card h-fit space-y-0 overflow-hidden p-0">
      {/* Tab bar */}
      <div className="flex border-b border-border-subtle">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
              activeTab === t.id
                ? "border-b-2 border-brand-primary text-text-primary"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Versions tab */}
      {activeTab === "versions" && (
        <div className="p-3 space-y-1">
          {versions.length === 0 ? (
            <p className="text-xs text-text-muted py-2">No versions yet</p>
          ) : (() => {
            const PAGE = 10;
            const reversed = [...versions].reverse();
            const visible = showAllVersions ? reversed : reversed.slice(0, PAGE);
            return (
              <>
                {visible.map((v, i) => {
                  const vNum = versions.length - i;
                  const isViewing = viewingVersion === v.id;
                  const isComparing = comparingVersion === v.id;
                  return (
                    <div
                      key={v.id}
                      className={`rounded-md border px-2 py-2 text-xs transition ${
                        isViewing || isComparing
                          ? "border-border-default bg-surface-muted"
                          : "border-transparent hover:bg-surface-subtle"
                      }`}
                    >
                      <div className="font-medium text-text-primary">
                        v{vNum}{v.note ? ` · ${v.note}` : ""}
                      </div>
                      <div className="text-text-muted">{timeAgo(v.createdAt)}</div>
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          className="text-[11px] text-text-muted hover:text-text-primary"
                          onClick={() => {
                            setComparingVersion(null);
                            setViewingVersion(isViewing ? null : v.id);
                          }}
                        >
                          {isViewing ? "Close" : "View"}
                        </button>
                        {currentDraft && (
                          <button
                            type="button"
                            className="text-[11px] text-info-fill hover:text-info-text"
                            onClick={() => {
                              setViewingVersion(null);
                              setComparingVersion(isComparing ? null : v.id);
                            }}
                          >
                            {isComparing ? "Close diff" : "Compare"}
                          </button>
                        )}
                        {isViewing && (
                          <button
                            type="button"
                            className="text-[11px] text-success-fill hover:text-success-text"
                            onClick={() => onRestoreVersion(v)}
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {versions.length > PAGE && (
                  <button
                    type="button"
                    className="w-full text-[11px] text-text-muted hover:text-text-primary py-1"
                    onClick={() => setShowAllVersions(s => !s)}
                  >
                    {showAllVersions ? "Show less" : `Show all (${versions.length})`}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Coherence tab */}
      {activeTab === "coherence" && isPetition && narrativeId && (
        <div className="p-0">
          <CoherenceBlock
            caseId={caseId}
            narrativeId={narrativeId}
            draftedCount={draftedCount}
            totalSections={totalSections}
            initialReport={initialCoherence}
            headers={settingsHeaders()}
            outline={outline}
            onJumpToSection={onJumpToSection}
            compact
          />
        </div>
      )}

      {/* Ledger tab */}
      {activeTab === "ledger" && evidenceLedger && (
        <div className="p-3 space-y-3">
          <p className="text-xs text-text-muted">
            Voice-neutral fact ledger injected into every section draft.
            Regenerated automatically when intake data changes.
          </p>
          <p className="text-[10px] text-text-muted">
            Generated {timeAgo(evidenceLedger.generatedAt)} · {evidenceLedger.facts.length} facts
          </p>
          <ul className="space-y-1.5">
            {evidenceLedger.facts.map((fact, i) => (
              <li key={i} className="text-xs text-text-secondary leading-relaxed border-l-2 border-border-subtle pl-2">
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
