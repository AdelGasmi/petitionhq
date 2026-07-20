import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("verifyTurnstile", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns true when TURNSTILE_SECRET_KEY is not set (fail-open)", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile("any-token", "1.2.3.4");
    expect(result).toBe(true);
  });

  it("returns false when token is missing and secret is set", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile(undefined, "1.2.3.4");
    expect(result).toBe(false);
  });

  it("returns false for empty string token", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile("", "1.2.3.4");
    expect(result).toBe(false);
  });

  it("calls Cloudflare siteverify API with correct params", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret-key";

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile("user-token-123", "10.0.0.1");

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(opts.method).toBe("POST");

    const body = opts.body as URLSearchParams;
    expect(body.get("secret")).toBe("test-secret-key");
    expect(body.get("response")).toBe("user-token-123");
    expect(body.get("remoteip")).toBe("10.0.0.1");
  });

  it("returns false when Cloudflare responds with success: false", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }));

    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile("bad-token", "1.2.3.4");
    expect(result).toBe(false);
  });

  it("returns true (fail-open) when fetch throws", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile("some-token", "1.2.3.4");
    expect(result).toBe(true);
  });

  it("returns true (fail-open) when client widget errored", async () => {
    process.env.TURNSTILE_SECRET_KEY = "test-secret";
    const { verifyTurnstile } = await import("../lib/turnstile");
    const result = await verifyTurnstile("__turnstile_failed__", "1.2.3.4");
    expect(result).toBe(true);
  });
});
