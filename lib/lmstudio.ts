/**
 * Provider-agnostic LLM completion helpers.
 *
 * Wraps the Vercel AI SDK (generateText / streamText) with the same interface
 * that existed when LM Studio was the only provider, so all callers are unchanged.
 *
 * Provider routing is handled by lib/llm.ts (LLM_PROVIDER env var).
 */

import { generateText, streamText } from "ai";
import { getModel, getModelName, llmHealthCheck, type LlmTier } from "./llm";
import { recordUsage, type UsageContext } from "./llm-usage";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LlmOptions = {
  model?: string;          // ignored — provider/model selected by LLM_PROVIDER env
  tier?: LlmTier;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  system?: string;         // system prompt (recommended over messages with role: "system")
  usageContext?: UsageContext;
};

/**
 * Drafting-tier temperature policy. Legal prose needs deterministic structural
 * adherence — 0.7 introduced too much entropy (weakened negative-constraint and
 * pronoun adherence over long contexts). We cap the drafting tier server-side so
 * a stale client setting (localStorage still holding 0.7) can never override it,
 * and default un-specified drafting calls to 0.4. The fast tier is unchanged —
 * its callers already pin low temperatures (0–0.2).
 */
export const DRAFTING_TEMP_MAX = 0.45;
export const DRAFTING_TEMP_DEFAULT = 0.4;

export function resolveTemperature(tier: LlmTier, requested: number | undefined): number {
  if (tier === "drafting") {
    if (requested === undefined || Number.isNaN(requested)) return DRAFTING_TEMP_DEFAULT;
    return Math.min(requested, DRAFTING_TEMP_MAX);
  }
  return requested ?? 0.7;
}

/** Simple completion — returns the assistant's text. */
export async function complete(
  messages: LlmMessage[],
  opts: LlmOptions = {}
): Promise<string> {
  // Extract system from messages if not provided in options
  let system = opts.system;
  let userMessages = messages;
  if (!system && messages[0]?.role === "system") {
    system = messages[0].content;
    userMessages = messages.slice(1);
  }

  const tier = opts.tier ?? "drafting";
  const { text, usage } = await generateText({
    model: getModel(tier),
    system,
    messages: userMessages,
    temperature: resolveTemperature(tier, opts.temperature),
    maxOutputTokens: opts.maxTokens ?? 8192,
    abortSignal: opts.signal,
  });

  if (usage && opts.usageContext) {
    recordUsage(
      opts.usageContext,
      getModelName(tier),
      usage.inputTokens ?? 0,
      usage.outputTokens ?? 0,
    );
  }

  return text;
}

/** Streaming completion — yields text chunks as they arrive. */
export async function* completeStream(
  messages: LlmMessage[],
  opts: LlmOptions = {}
): AsyncGenerator<string, void, unknown> {
  // Extract system from messages if not provided in options
  let system = opts.system;
  let userMessages = messages;
  if (!system && messages[0]?.role === "system") {
    system = messages[0].content;
    userMessages = messages.slice(1);
  }

  const tier = opts.tier ?? "drafting";
  const result = streamText({
    model: getModel(tier),
    system,
    messages: userMessages,
    temperature: resolveTemperature(tier, opts.temperature),
    maxOutputTokens: opts.maxTokens ?? 8192,
    abortSignal: opts.signal,
  });

  for await (const chunk of result.textStream) {
    yield chunk;
  }

  if (opts.usageContext) {
    const usage = await result.usage;
    if (usage) {
      recordUsage(
        opts.usageContext,
        getModelName(tier),
        usage.inputTokens ?? 0,
        usage.outputTokens ?? 0,
      );
    }
  }
}

/**
 * Structured completion — asks the model to return JSON, auto-strips code fences,
 * retries once on parse failure.
 */
export async function completeStructured<T>(
  messages: LlmMessage[],
  opts: LlmOptions = {}
): Promise<T> {
  const raw = await complete(messages, opts);
  const parsed = tryParseJson(raw);
  if (parsed !== undefined) return parsed as T;

  const retry = await complete(
    [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content:
          "That wasn't valid JSON. Return ONLY the JSON object, no prose, no markdown fences, no explanation.",
      },
    ],
    opts
  );
  const parsedRetry = tryParseJson(retry);
  if (parsedRetry !== undefined) return parsedRetry as T;

  throw new Error(
    `LLM failed to return valid JSON after retry. First 400 chars: ${raw.slice(0, 400)}`
  );
}

/** Check if the configured LLM provider is reachable. */
export async function healthCheck(): Promise<{ ok: boolean; models?: string[]; error?: string }> {
  const result = await llmHealthCheck();
  return { ok: result.ok, error: result.error };
}

/** Invalidate any cached state (no-op now — provider is stateless). */
export function invalidateModelCache(): void {}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function tryParseJson(text: string): unknown | undefined {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
