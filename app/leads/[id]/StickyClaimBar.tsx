"use client";

import { useEffect, useState } from "react";
import { ClaimButton } from "./ClaimButton";

type Props = {
  leadId: string;
  tierLabel: string;
  tierStatusToken: string;
  trustScore: number | null;
  sentinelId: string;
};

export function StickyClaimBar({ leadId, tierLabel, tierStatusToken, trustScore, sentinelId }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.getElementById(sentinelId);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinelId]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface-card border-t border-border-default shadow-lg px-4 py-3 lg:hidden">
      <div className="mx-auto max-w-5xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`badge badge-${tierStatusToken} shrink-0`}>{tierLabel}</span>
          {trustScore != null && trustScore > 0 && (
            <span className={`text-xs font-semibold ${
              trustScore >= 80 ? "text-success-text"
              : trustScore >= 60 ? "text-warning-text"
              : "text-danger-text"
            }`}>
              Trust {trustScore}/100
            </span>
          )}
          <span className="text-xs text-text-muted hidden sm:block">Auto-refund if no intake in 14 days</span>
        </div>
        <div className="shrink-0">
          <ClaimButton leadId={leadId} />
        </div>
      </div>
    </div>
  );
}
