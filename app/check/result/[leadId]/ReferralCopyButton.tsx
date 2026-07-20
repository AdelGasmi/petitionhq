"use client";

import { useState } from "react";

export function ReferralCopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the text
    }
  };

  return (
    <div className="flex items-center gap-2 mt-1">
      <code className="flex-1 rounded bg-surface-card border border-border-default px-3 py-1.5 text-xs text-text-secondary truncate">
        {url}
      </code>
      <button
        onClick={handleCopy}
        className="shrink-0 rounded-lg border border-border-default bg-surface-card px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-border-strong transition-colors"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
