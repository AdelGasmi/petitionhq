"use client";

/**
 * Settings — persisted to localStorage, read by API calls via custom headers.
 * Keeps settings client-side so there's no user/auth coupling.
 */

const KEY = "petition-settings";

export type Settings = {
  draftingModel: string;   // LM Studio model id for drafting
  fastModel: string;       // LM Studio model id for JSON extraction
  temperature: number;     // 0–1
};

export const DEFAULTS: Settings = {
  draftingModel: "gemma-4-e4b-it-optiq",
  fastModel: "gemma-4-e4b-it-optiq",
  // Drafting runs at a low temperature for deterministic legal structure. The
  // server also clamps the drafting tier (lib/lmstudio.ts resolveTemperature),
  // so stale localStorage can't push it back up.
  temperature: 0.4,
};

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

/** Build the headers to pass selected model to server actions / API routes. */
export function settingsHeaders(): HeadersInit {
  const s = loadSettings();
  const headers: Record<string, string> = {
    "x-llm-temperature": String(s.temperature),
  };
  // Only set headers when the user actually picked a model, so empty doesn't
  // override the server-side env defaults.
  if (s.draftingModel) headers["x-llm-model"] = s.draftingModel;
  if (s.fastModel) headers["x-llm-model-fast"] = s.fastModel;
  return headers;
}
