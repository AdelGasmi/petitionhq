/**
 * Integration tests — /api/cases/[id]
 *
 * Tests case CRUD with role-based access control.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
  testPrisma,
  buildRequest,
  mockSession,
  setupAuthMock,
  createTestUser,
  createTestCase,
  cleanupTestData,
  disconnectTestDb,
  type MockSession,
} from "./helpers";

setupAuthMock();

// Mock activity logging — don't pollute test DB
vi.mock("@/lib/activity", () => ({
  logActivity: vi.fn(),
}));

const { GET, PATCH, DELETE } = await import("@/app/api/cases/[id]/route");

let adminUser: Awaited<ReturnType<typeof createTestUser>>;
let attorneyUser: Awaited<ReturnType<typeof createTestUser>>;
let applicantUser: Awaited<ReturnType<typeof createTestUser>>;
let adminCase: Awaited<ReturnType<typeof createTestCase>>;
let attorneyCase: Awaited<ReturnType<typeof createTestCase>>;
let applicantCase: Awaited<ReturnType<typeof createTestCase>>;

const userIds: string[] = [];
const caseIds: string[] = [];

beforeAll(async () => {
  adminUser = await createTestUser({
    role: "admin",
    email: `cases-admin-${Date.now()}@test.com`,
  });
  attorneyUser = await createTestUser({
    role: "attorney",
    email: `cases-atty-${Date.now()}@test.com`,
    name: "Test Attorney",
  });
  applicantUser = await createTestUser({
    role: "applicant",
    email: `cases-app-${Date.now()}@test.com`,
  });
  userIds.push(adminUser.id, attorneyUser.id, applicantUser.id);

  adminCase = await createTestCase(adminUser.id, {
    title: "Admin Case",
    status: "draft",
  });
  attorneyCase = await createTestCase(applicantUser.id, {
    title: "Attorney Assigned Case",
    attorneyId: attorneyUser.id,
    status: "review",
  });
  applicantCase = await createTestCase(applicantUser.id, {
    title: "Applicant Own Case",
    status: "draft",
    formData: { field: "AI" },
  });
  caseIds.push(adminCase.id, attorneyCase.id, applicantCase.id);
});

afterAll(async () => {
  await cleanupTestData({ userIds, caseIds });
  await disconnectTestDb();
});

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function sessionFor(user: typeof adminUser, role: MockSession["role"]): MockSession {
  return {
    userId: user.id,
    email: user.email,
    role,
    name: user.name,
  };
}

describe("GET /api/cases/[id]", () => {
  it("returns 401 if not authenticated", async () => {
    mockSession(null);
    const req = buildRequest(`http://localhost:3000/api/cases/${adminCase.id}`);
    const res = await GET(req, makeParams(adminCase.id));
    expect(res.status).toBe(401);
  });

  it("admin CANNOT access case content (zero-trust)", async () => {
    mockSession(sessionFor(adminUser, "admin"));
    const req = buildRequest(`http://localhost:3000/api/cases/${applicantCase.id}`);
    const res = await GET(req, makeParams(applicantCase.id));
    expect(res.status).toBe(404);
  });

  it("attorney can access assigned case", async () => {
    mockSession(sessionFor(attorneyUser, "attorney"));
    const req = buildRequest(`http://localhost:3000/api/cases/${attorneyCase.id}`);
    const res = await GET(req, makeParams(attorneyCase.id));
    expect(res.status).toBe(200);
  });

  it("attorney cannot access unassigned case", async () => {
    mockSession(sessionFor(attorneyUser, "attorney"));
    const req = buildRequest(`http://localhost:3000/api/cases/${applicantCase.id}`);
    const res = await GET(req, makeParams(applicantCase.id));
    expect(res.status).toBe(404);
  });

  it("applicant can access own case", async () => {
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${applicantCase.id}`);
    const res = await GET(req, makeParams(applicantCase.id));
    expect(res.status).toBe(200);
  });

  it("applicant cannot access other's case", async () => {
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${adminCase.id}`);
    const res = await GET(req, makeParams(adminCase.id));
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent case", async () => {
    mockSession(sessionFor(adminUser, "admin"));
    const req = buildRequest("http://localhost:3000/api/cases/non-existent-id");
    const res = await GET(req, makeParams("non-existent-id"));
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/cases/[id]", () => {
  it("admin CANNOT PATCH case content (zero-trust)", async () => {
    mockSession(sessionFor(adminUser, "admin"));
    const req = buildRequest(`http://localhost:3000/api/cases/${adminCase.id}`, {
      method: "PATCH",
      body: { title: "Updated Title" },
    });
    const res = await PATCH(req, makeParams(adminCase.id));
    expect(res.status).toBe(404);
  });

  it("applicant can update own case title", async () => {
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${applicantCase.id}`, {
      method: "PATCH",
      body: { title: "My Updated Title" },
    });
    const res = await PATCH(req, makeParams(applicantCase.id));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("My Updated Title");
  });

  it("updates formData", async () => {
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${applicantCase.id}`, {
      method: "PATCH",
      body: { formData: { field: "Machine Learning", degree: "PhD" } },
    });
    const res = await PATCH(req, makeParams(applicantCase.id));
    expect(res.status).toBe(200);
  });

  it("rejects unauthorized PATCH", async () => {
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${adminCase.id}`, {
      method: "PATCH",
      body: { title: "Hacked" },
    });
    const res = await PATCH(req, makeParams(adminCase.id));
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/cases/[id]", () => {
  it("admin CANNOT delete via content route (zero-trust)", async () => {
    // Admin must use /api/admin/bulk-cases for deletion, not /api/cases/[id]
    const throwaway = await createTestCase(adminUser.id, { title: "Delete Me" });
    caseIds.push(throwaway.id);
    mockSession(sessionFor(adminUser, "admin"));
    const req = buildRequest(`http://localhost:3000/api/cases/${throwaway.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams(throwaway.id));
    expect(res.status).toBe(404);

    // Verify NOT deleted — admin blocked
    const c = await testPrisma.case.findUnique({ where: { id: throwaway.id } });
    expect(c).not.toBeNull();
  });

  it("case owner can delete own case", async () => {
    const throwaway = await createTestCase(applicantUser.id, { title: "Owner Delete Me" });
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${throwaway.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams(throwaway.id));
    expect(res.status).toBe(200);

    const c = await testPrisma.case.findUnique({ where: { id: throwaway.id } });
    expect(c).toBeNull();
  });

  it("applicant cannot delete another's case", async () => {
    mockSession(sessionFor(applicantUser, "applicant"));
    const req = buildRequest(`http://localhost:3000/api/cases/${adminCase.id}`, {
      method: "DELETE",
    });
    const res = await DELETE(req, makeParams(adminCase.id));
    expect(res.status).toBe(404);
  });
});
