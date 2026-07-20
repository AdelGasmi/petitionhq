/**
 * Provider-agnostic LLM router.
 *
 * LLM_PROVIDER=lmstudio  → local LM Studio via OpenAI-compatible endpoint
 * LLM_PROVIDER=anthropic → Anthropic Claude via Anthropic API
 *
 * Returns a Vercel AI SDK LanguageModel that works with generateText / streamText.
 */

import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { readFileSync } from "fs";
import { resolve } from "path";

export type LlmTier = "drafting" | "fast";

function getAnthropicKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  // Claude Code injects ANTHROPIC_API_KEY="" which blocks .env.local loading.
  // Read the file directly as a fallback. On the client bundle fs resolves to
  // an empty module (next.config.js resolve.fallback) so readFileSync is
  // undefined — the try/catch handles it gracefully.
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const match = envFile.match(/^ANTHROPIC_API_KEY=(.+)$/m);
    if (match?.[1]) return match[1];
  } catch { /* fs unavailable in browser, or file not found */ }
  return "";
}

export function getModelName(tier: LlmTier = "drafting"): string {
  const provider = process.env.LLM_PROVIDER ?? "lmstudio";
  if (provider === "anthropic") {
    return tier === "fast" ? "claude-haiku-4-5" : "claude-sonnet-4-6";
  }
  if (provider === "lmstudio") {
    const envModel = tier === "fast"
      ? process.env.LMSTUDIO_MODEL_FAST || process.env.LMSTUDIO_MODEL || ""
      : process.env.LMSTUDIO_MODEL || "";
    return envModel || "local-model";
  }
  return "unknown";
}

export function getModel(tier: LlmTier = "drafting"): LanguageModel {
  const provider = process.env.LLM_PROVIDER ?? "lmstudio";

  if (provider === "anthropic") {
    const apiKey = getAnthropicKey();
    if (!apiKey) {
      throw new Error("LLM_PROVIDER=anthropic requires ANTHROPIC_API_KEY");
    }
    const anthropic = createAnthropic({ apiKey, baseURL: "https://api.anthropic.com/v1" });
    const model = getModelName(tier);
    return anthropic(model);
  }

  if (provider === "lmstudio") {
    const baseURL =
      process.env.LMSTUDIO_URL ?? "http://host.docker.internal:1234/v1";
    const lmstudio = createOpenAI({ baseURL, apiKey: "not-needed" });
    return lmstudio(getModelName(tier));
  }

  throw new Error(`Unknown LLM_PROVIDER: "${provider}". Set to "anthropic" or "lmstudio".`);
}

/** Health check result across all providers. */
export async function llmHealthCheck(): Promise<{ ok: boolean; provider: string; error?: string }> {
  const provider = process.env.LLM_PROVIDER ?? "lmstudio";

  if (provider === "anthropic") {
    if (!getAnthropicKey()) {
      return { ok: false, provider, error: "ANTHROPIC_API_KEY not set" };
    }
    return { ok: true, provider };
  }

  if (provider === "lmstudio") {
    const url = process.env.LMSTUDIO_URL ?? "http://localhost:1234/v1";
    try {
      const res = await fetch(`${url}/models`, {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      if (!res.ok) return { ok: false, provider, error: `LM Studio responded ${res.status}` };
      const data = await res.json();
      const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id);
      if (!models.length) return { ok: false, provider, error: "LM Studio reachable but no model loaded" };
      return { ok: true, provider };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, provider, error: `LM Studio not reachable at ${url}: ${msg}` };
    }
  }

  return { ok: false, provider, error: `Unknown provider: ${provider}` };
}
