"use client";

import { useEffect, useState } from "react";

const DEFAULT_CAPTIONS = [
  "Reviewing your credentials",
  "Mapping evidence to the Dhanasar prongs",
  "Scoring your petition strength",
];

const CAPTION_INTERVAL_MS = 1_800;

/**
 * Minimalist loading state shown while a /check assessment runs.
 *
 * Two restrained moving parts: a thin indeterminate sweep bar (reuses the
 * `grow` keyframe) and a single rotating caption. No spinners-as-emoji, no
 * raw colors — tokens only. Honors prefers-reduced-motion: under reduce the
 * bar holds a calm static fill and the caption stops rotating-in (see the
 * `.assess-loader-*` rules in globals.css). Replaces the ad-hoc spinners that
 * previously sat on the email gate and the deep-wizard wait.
 */
export function AssessmentLoader({
  title = "Analyzing your profile",
  captions = DEFAULT_CAPTIONS,
}: {
  title?: string;
  captions?: string[];
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (captions.length <= 1) return;
    const t = setInterval(
      () => setI((n) => (n + 1) % captions.length),
      CAPTION_INTERVAL_MS,
    );
    return () => clearInterval(t);
  }, [captions.length]);

  return (
    <div className="mx-auto max-w-md py-20">
      <div className="card-lg space-y-6 text-center" aria-busy="true">
        <div className="space-y-2">
          <h2 className="font-serif text-2xl tracking-tight text-text-primary">{title}</h2>
          <p
            key={i}
            className="assess-loader-caption text-sm text-text-muted"
            aria-live="polite"
          >
            {captions[i]}
          </p>
        </div>

        <div
          className="assess-loader-track mx-auto max-w-xs"
          role="progressbar"
          aria-label={title}
        >
          <div className="assess-loader-bar" />
        </div>
      </div>
    </div>
  );
}
