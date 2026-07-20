"use client";

import { useState, useEffect } from "react";

const CAPTIONS = [
  "Checking OpenAlex — publications & citations",
  "Looking up institution in ROR",
  "Searching NIH & NSF grants databases",
  "Confirming ORCID record",
  "Compiling verification report",
];

const CAPTION_INTERVAL_MS = 1_800;

type Props = {
  leadId: string;
  resultToken: string;
  onComplete: (result: {
    trustScore: number;
    verifiedClaims: Record<string, unknown>;
  }) => void;
  onTimeout: () => void;
};

/**
 * Animated loader shown while the verification orchestrator runs.
 * Uses the AssessmentLoader sweep pattern: indeterminate bar + rotating
 * caption. Honors prefers-reduced-motion via assess-loader-* CSS classes.
 */
export function VerificationLoader({ leadId, resultToken, onComplete, onTimeout }: Props) {
  const [captionIndex, setCaptionIndex] = useState(0);

  useEffect(() => {
    if (CAPTIONS.length <= 1) return;
    const t = setInterval(
      () => setCaptionIndex((i) => (i + 1) % CAPTIONS.length),
      CAPTION_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let didFinish = false;

    const timeout = setTimeout(() => {
      if (!didFinish) {
        didFinish = true;
        onTimeout();
      }
    }, 12_000);

    fetch(`/api/leads/${leadId}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resultToken }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!didFinish) {
          didFinish = true;
          clearTimeout(timeout);
          setTimeout(() => {
            onComplete({
              trustScore: data.trustScore,
              verifiedClaims: data.verifiedClaims ?? {},
            });
          }, 400);
        }
      })
      .catch(() => {
        if (!didFinish) {
          didFinish = true;
          clearTimeout(timeout);
          onTimeout();
        }
      });

    return () => clearTimeout(timeout);
  }, [leadId, onComplete, onTimeout]);

  return (
    <div className="rounded-xl border border-verify-border bg-gradient-to-b from-verify-bg to-surface-card px-6 py-8 text-center space-y-6">
      <div className="space-y-2">
        <h3 className="font-serif text-xl text-text-primary">Verifying your credentials</h3>
        <p
          key={captionIndex}
          className="assess-loader-caption text-sm text-text-secondary"
          aria-live="polite"
        >
          {CAPTIONS[captionIndex]}
        </p>
      </div>

      <div
        className="assess-loader-track mx-auto max-w-xs"
        role="progressbar"
        aria-label="Verifying credentials"
      >
        <div className="assess-loader-bar" />
      </div>

      <p className="text-xs text-text-muted">Checking 7+ public research databases</p>
    </div>
  );
}
