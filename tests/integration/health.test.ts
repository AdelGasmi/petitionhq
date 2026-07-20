/**
 * Integration tests — GET /api/health
 *
 * Verifies the health endpoint returns structured status for DB, LLM, storage.
 */

import { describe, it, expect, vi, afterAll } from "vitest";
import { buildRequest, disconnectTestDb } from "./helpers";

// Mock LLM health — don't make real API calls
vi.mock("@/lib/llm", () => ({
  llmHealthCheck: vi.fn(() =>
    Promise.resolve({ ok: true, provider: "anthropic" })
  ),
  getModel: vi.fn(),
}));

const { GET } = await import("@/app/api/health/route");

afterAll(async () => {
  await disconnectTestDb();
});

describe("GET /api/health", () => {
  it("returns 200 with structured health data", async () => {
    const req = buildRequest("http://localhost:3000/api/health");
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.db).toBe("ok");
    expect(data.llm).toBeDefined();
    expect(data.llm.ok).toBe(true);
    expect(data.llm.provider).toBe("anthropic");
    expect(data.ts).toBeTruthy();
  });
});
