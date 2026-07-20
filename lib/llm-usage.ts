import { prisma } from "./prisma";
import logger from "./logger";

const COST_PER_1K: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5":  { input: 0.1, output: 0.5 },
  "claude-sonnet-4-6": { input: 0.3, output: 1.5 },
  "claude-opus-4-6":   { input: 1.5, output: 7.5 },
};

const DEFAULT_COST = { input: 0.3, output: 1.5 };

function costCents(model: string, tokensIn: number, tokensOut: number): number {
  const rate = COST_PER_1K[model] ?? DEFAULT_COST;
  return (tokensIn / 1000) * rate.input + (tokensOut / 1000) * rate.output;
}

export type UsageContext = {
  caseId?: string;
  leadId?: string;
  route: string;
};

export function recordUsage(
  ctx: UsageContext,
  model: string,
  tokensIn: number,
  tokensOut: number,
): void {
  const cents = costCents(model, tokensIn, tokensOut);
  void prisma.llmUsage.create({
    data: {
      caseId: ctx.caseId ?? null,
      leadId: ctx.leadId ?? null,
      route: ctx.route,
      model,
      tokensIn,
      tokensOut,
      cents,
    },
  }).catch((err: unknown) => logger.error("llm-usage write failed", err));
}
