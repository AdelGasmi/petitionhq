/**
 * Integration tests — POST /api/auth/login
 *
 * Tests the full login flow: validation, bcrypt comparison,
 * lockout enforcement, JWT cookie issuance.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import bcrypt from "bcryptjs";
import {
  testPrisma,
  buildRequest,
  cleanupTestData,
  disconnectTestDb,
} from "./helpers";

// We import the route handler directly — no HTTP server needed
const { POST } = await import("@/app/api/auth/login/route");

const TEST_EMAIL = `login-test-${Date.now()}@test.com`;
const TEST_PASSWORD = "Str0ng!Pass";
let userId = "";

beforeAll(async () => {
  const hash = await bcrypt.hash(TEST_PASSWORD, 10);
  const user = await testPrisma.user.create({
    data: {
      email: TEST_EMAIL,
      name: "Login Test",
      role: "admin",
      passwordHash: hash,
      verified: true,
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await cleanupTestData({ userIds: [userId] });
  await disconnectTestDb();
});

describe("POST /api/auth/login", () => {
  it("returns 400 if email is missing", async () => {
    const req = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: { password: "something" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required");
  });

  it("returns 400 if password is missing", async () => {
    const req = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: { email: TEST_EMAIL },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 for non-existent email", async () => {
    const req = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: { email: "nobody-exists@test.com", password: "whatever" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("Invalid email or password");
  });

  it("returns 401 for wrong password", async () => {
    const req = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: { email: TEST_EMAIL, password: "wrong-password" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 200 and sets session cookie on valid login", async () => {
    const req = buildRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      body: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.role).toBe("admin");

    // Check session cookie was set
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("petition_session");
  });

  it("returns 403 for unverified user", async () => {
    const hash = await bcrypt.hash("test123", 10);
    const unverified = await testPrisma.user.create({
      data: {
        email: `unverified-${Date.now()}@test.com`,
        name: "Unverified",
        role: "applicant",
        passwordHash: hash,
        verified: false,
      },
    });

    try {
      const req = buildRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: { email: unverified.email, password: "test123" },
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.requiresVerification).toBe(true);
    } finally {
      await testPrisma.user.delete({ where: { id: unverified.id } });
    }
  });

  it("triggers lockout after repeated failures", async () => {
    const hash = await bcrypt.hash("lockout-test", 10);
    const lockUser = await testPrisma.user.create({
      data: {
        email: `lockout-${Date.now()}@test.com`,
        name: "Lockout Test",
        role: "applicant",
        passwordHash: hash,
        verified: true,
      },
    });

    try {
      // 5 failed attempts should trigger lockout
      for (let i = 0; i < 5; i++) {
        const req = buildRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          body: { email: lockUser.email, password: "wrong" },
        });
        await POST(req);
      }

      // 6th attempt should be locked
      const req = buildRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: { email: lockUser.email, password: "lockout-test" },
      });
      const res = await POST(req);
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    } finally {
      await testPrisma.user.delete({ where: { id: lockUser.id } });
    }
  });
});
