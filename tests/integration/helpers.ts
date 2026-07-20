/**
 * Integration test helpers — real DB, mocked auth.
 *
 * Requires local Postgres on port 5433 (Docker dev compose).
 * Each test suite cleans up after itself.
 */

import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { vi } from "vitest";

// Use test database
const TEST_DB_URL = process.env.DATABASE_URL ?? "postgresql://petition:petition_dev@localhost:5433/petition";

export const testPrisma = new PrismaClient({ datasourceUrl: TEST_DB_URL });

// ---------------------------------------------------------------------------
// Auth mocking — inject a fake session for route handlers
// ---------------------------------------------------------------------------

export type MockSession = {
  userId: string;
  email: string;
  role: "admin" | "attorney" | "applicant";
  name: string;
  guestCaseId?: string;
};

let currentMockSession: MockSession | null = null;

export function mockSession(session: MockSession | null) {
  currentMockSession = session;
}

/**
 * Call this in beforeAll to set up auth mocking.
 * Mocks `@/lib/auth` so getSession() returns the mock session.
 */
export function setupAuthMock() {
  vi.mock("@/lib/auth", async () => {
    const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    return {
      ...actual,
      getSession: vi.fn(() => Promise.resolve(currentMockSession)),
      requireSession: vi.fn(async () => {
        if (!currentMockSession) throw new Error("Not authenticated");
        return currentMockSession;
      }),
      requireAdmin: vi.fn(async () => {
        if (!currentMockSession) throw new Error("Not authenticated");
        if (currentMockSession.role !== "admin") throw new Error("Forbidden");
        return currentMockSession;
      }),
      requireAttorneyOrAdmin: vi.fn(async () => {
        if (!currentMockSession) throw new Error("Not authenticated");
        if (currentMockSession.role !== "attorney" && currentMockSession.role !== "admin") throw new Error("Forbidden");
        return currentMockSession;
      }),
    };
  });
}

/**
 * Mock Turnstile to always pass (we test Turnstile separately in unit tests).
 */
export function setupTurnstileMock() {
  vi.mock("@/lib/turnstile", () => ({
    verifyTurnstile: vi.fn(() => Promise.resolve(true)),
  }));
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

export function buildRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const { method = "GET", body, headers = {} } = options;
  const init: Record<string, unknown> = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(new URL(url, "http://localhost:3000"), init as any);
}

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

export async function createTestUser(overrides: Partial<{
  email: string;
  name: string;
  role: "admin" | "attorney" | "applicant";
  password: string;
  verified: boolean;
}> = {}) {
  const email = overrides.email ?? `test-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  const hash = await bcrypt.hash(overrides.password ?? "test123", 10);
  return testPrisma.user.create({
    data: {
      email,
      name: overrides.name ?? "Test User",
      role: overrides.role ?? "admin",
      passwordHash: hash,
      verified: overrides.verified ?? true,
    },
  });
}

export async function createTestCase(userId: string, overrides: Partial<{
  title: string;
  formId: string;
  status: "draft" | "review" | "ready" | "filed";
  attorneyId: string;
  formData: object;
}> = {}) {
  return testPrisma.case.create({
    data: {
      ownerId: userId,
      title: overrides.title ?? "Test NIW Case",
      formId: overrides.formId ?? "i140-niw",
      status: overrides.status ?? "draft",
      attorneyId: overrides.attorneyId ?? null,
      formData: overrides.formData ?? {},
    },
  });
}

export async function createTestLead(overrides: Partial<{
  email: string;
  name: string;
  tier: string;
  score: number;
  status: string;
  formData: object;
}> = {}) {
  const email = overrides.email ?? `lead-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
  return testPrisma.lead.create({
    data: {
      email,
      resultToken: randomBytes(24).toString("hex"),
      name: overrides.name ?? "Test Lead",
      tier: overrides.tier ?? "tier1",
      score: overrides.score ?? 75,
      status: overrides.status ?? "new",
      formData: overrides.formData ?? {},
      source: "test",
    },
  });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

/** Clean up all test data. Call in afterAll. */
export async function cleanupTestData(ids: {
  userIds?: string[];
  caseIds?: string[];
  leadIds?: string[];
}) {
  // Delete in dependency order
  if (ids.caseIds?.length) {
    await testPrisma.activityLog.deleteMany({ where: { caseId: { in: ids.caseIds } } });
    await testPrisma.letterVersion.deleteMany({
      where: { letter: { caseId: { in: ids.caseIds } } },
    });
    await testPrisma.letterComment.deleteMany({
      where: { letter: { caseId: { in: ids.caseIds } } },
    });
    await testPrisma.letter.deleteMany({ where: { caseId: { in: ids.caseIds } } });
    await testPrisma.document.deleteMany({ where: { caseId: { in: ids.caseIds } } });
    await testPrisma.sectionComment.deleteMany({ where: { caseId: { in: ids.caseIds } } });
    await testPrisma.message.deleteMany({ where: { caseId: { in: ids.caseIds } } });
    await testPrisma.caseNote.deleteMany({ where: { caseId: { in: ids.caseIds } } });
    await testPrisma.case.deleteMany({ where: { id: { in: ids.caseIds } } });
  }
  if (ids.leadIds?.length) {
    await testPrisma.lead.deleteMany({ where: { id: { in: ids.leadIds } } });
  }
  if (ids.userIds?.length) {
    await testPrisma.token.deleteMany({ where: { subjectId: { in: ids.userIds } } });
    await testPrisma.firmProfile.deleteMany({ where: { userId: { in: ids.userIds } } });
    await testPrisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
  }
}

export async function disconnectTestDb() {
  await testPrisma.$disconnect();
}
