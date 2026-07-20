import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Forgot/reset-password route guards. The token-level crypto (6-digit scoped
 * code, timing-safe compare) is exercised by the existing token system; here we
 * pin the route contracts: Turnstile gate, anti-enumeration, code states, the
 * 8-char minimum, and that a successful reset bumps sessionVersion (revoking all
 * existing sessions) before auto-login.
 */

vi.mock("@/lib/users", () => ({
  findUserByEmail: vi.fn(),
  issuePasswordResetCode: vi.fn(),
  consumePasswordResetCode: vi.fn(),
}));
vi.mock("@/lib/turnstile", () => ({ verifyTurnstile: vi.fn().mockResolvedValue(true) }));
vi.mock("@/lib/email", () => ({ sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { update: vi.fn() } } }));
vi.mock("@/lib/session-revoke", () => ({ setSessionRevocationVersion: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/auth", () => ({
  signToken: vi.fn().mockResolvedValue("signed.jwt"),
  sessionCookieOptions: vi.fn().mockReturnValue({ name: "ph_session", value: "signed.jwt" }),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn().mockResolvedValue({ set: vi.fn() }) }));

import { POST as forgot } from "@/app/api/auth/forgot-password/route";
import { POST as reset } from "@/app/api/auth/reset-password/route";
import { findUserByEmail, issuePasswordResetCode, consumePasswordResetCode } from "@/lib/users";
import { verifyTurnstile } from "@/lib/turnstile";
import { prisma } from "@/lib/prisma";

function req(body: unknown) {
  return new NextRequest("http://localhost/api/auth/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const passwordUser = { id: "u1", email: "atty@x.com", name: "Atty", role: "attorney", passwordHash: "$2a$hash", suspended: false };

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects when Turnstile fails (403)", async () => {
    (verifyTurnstile as any).mockResolvedValueOnce(false);
    const res = await forgot(req({ email: "atty@x.com" }));
    expect(res.status).toBe(403);
  });

  it("anti-enumeration: unknown email still returns ok and issues no code", async () => {
    (findUserByEmail as any).mockResolvedValue(null);
    const res = await forgot(req({ email: "nobody@x.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
    expect(issuePasswordResetCode).not.toHaveBeenCalled();
  });

  it("does not issue a code for an invited-but-not-setup account (empty hash)", async () => {
    (findUserByEmail as any).mockResolvedValue({ ...passwordUser, passwordHash: "" });
    const res = await forgot(req({ email: "atty@x.com" }));
    expect(res.status).toBe(200);
    expect(issuePasswordResetCode).not.toHaveBeenCalled();
  });

  it("issues + sends a code for a real password account", async () => {
    (findUserByEmail as any).mockResolvedValue(passwordUser);
    (issuePasswordResetCode as any).mockResolvedValue("123456");
    const res = await forgot(req({ email: "atty@x.com" }));
    expect(res.status).toBe(200);
    expect(issuePasswordResetCode).toHaveBeenCalledWith("u1");
  });
});

describe("POST /api/auth/reset-password", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a password shorter than 8 chars (400)", async () => {
    const res = await reset(req({ email: "atty@x.com", code: "123456", password: "short" }));
    expect(res.status).toBe(400);
    expect(consumePasswordResetCode).not.toHaveBeenCalled();
  });

  it("returns a generic 400 for an unknown email (no enumeration)", async () => {
    (findUserByEmail as any).mockResolvedValue(null);
    const res = await reset(req({ email: "nobody@x.com", code: "123456", password: "longenough" }));
    expect(res.status).toBe(400);
  });

  it("surfaces an expired code as 410", async () => {
    (findUserByEmail as any).mockResolvedValue(passwordUser);
    (consumePasswordResetCode as any).mockResolvedValue("expired");
    const res = await reset(req({ email: "atty@x.com", code: "123456", password: "longenough" }));
    expect(res.status).toBe(410);
  });

  it("surfaces a wrong code as 400", async () => {
    (findUserByEmail as any).mockResolvedValue(passwordUser);
    (consumePasswordResetCode as any).mockResolvedValue("wrong");
    const res = await reset(req({ email: "atty@x.com", code: "000000", password: "longenough" }));
    expect(res.status).toBe(400);
  });

  it("on a valid code: sets the password, bumps sessionVersion, and signs in", async () => {
    (findUserByEmail as any).mockResolvedValue(passwordUser);
    (consumePasswordResetCode as any).mockResolvedValue("ok");
    (prisma.user.update as any).mockResolvedValue({ sessionVersion: 2, email: "atty@x.com", role: "attorney", name: "Atty", suspended: false });
    const res = await reset(req({ email: "atty@x.com", code: "123456", password: "longenough" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, role: "attorney" });
    const updateArg = (prisma.user.update as any).mock.calls[0][0];
    expect(updateArg.data.sessionVersion).toEqual({ increment: 1 });
    expect(updateArg.data.verified).toBe(true);
    expect(typeof updateArg.data.passwordHash).toBe("string");
  });
});
