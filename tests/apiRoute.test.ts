import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { withRoute, ApiError, apiError } from "@/lib/api/route";

// Silence the catch-all's logger.error in test output.
vi.mock("@/lib/logger", () => ({ default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

const req = (method = "POST") =>
  new NextRequest("http://localhost/api/things", { method });

describe("withRoute", () => {
  it("passes through a normal response untouched", async () => {
    const handler = withRoute(async () =>
      Response.json({ ok: true }, { status: 201 }),
    );
    const res = await handler(req());
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("preserves the route context (params) argument", async () => {
    const handler = withRoute(
      async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
        const { id } = await ctx.params;
        return Response.json({ id });
      },
    );
    const res = await handler(req(), { params: Promise.resolve({ id: "abc" }) });
    expect(await res.json()).toEqual({ id: "abc" });
  });

  it("maps a thrown ApiError to its status + message", async () => {
    const handler = withRoute(async () => {
      apiError(403, "Forbidden");
    });
    const res = await handler(req());
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("turns an unexpected throw into a logged 500 with a generic body", async () => {
    const { default: logger } = await import("@/lib/logger");
    const handler = withRoute(async () => {
      throw new Error("db exploded with secret connection string");
    });
    const res = await handler(req());
    expect(res.status).toBe(500);
    // Generic body — never leaks the underlying error message to the client.
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(logger.error).toHaveBeenCalled();
  });

  it("ApiError carries its status", () => {
    const e = new ApiError(404, "nope");
    expect(e.status).toBe(404);
    expect(e.name).toBe("ApiError");
    expect(e instanceof Error).toBe(true);
  });
});
