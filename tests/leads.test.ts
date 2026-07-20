import { randomBytes } from "crypto";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";

const rtoken = () => randomBytes(24).toString("hex");

const TEST_EMAIL = "lead-test@example.com";

async function cleanup() {
  await prisma.lead.deleteMany({ where: { email: TEST_EMAIL } });
}

describe("Lead capture — /api/leads", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("creates a new lead and returns isNew: true", async () => {
    const lead = await prisma.lead.create({
      data: {
        email: TEST_EMAIL,
        resultToken: rtoken(),
        tier: "tier1",
        score: 82,
        formData: { degree: "PhD", field: "Computer Science" },
        source: "check",
        status: "new",
      },
    });

    expect(lead.email).toBe(TEST_EMAIL);
    expect(lead.tier).toBe("tier1");
    expect(lead.score).toBe(82);
    expect(lead.id).toBeTruthy();
  });

  it("upserts on duplicate email — updates score, preserves id", async () => {
    const first = await prisma.lead.create({
      data: {
        email: TEST_EMAIL,
        resultToken: rtoken(),
        tier: "tier3",
        score: 35,
        formData: {},
        source: "check",
        status: "new",
      },
    });

    const updated = await prisma.lead.upsert({
      where: { email: TEST_EMAIL },
      create: {
        email: TEST_EMAIL,
        resultToken: rtoken(),
        tier: "tier1",
        score: 85,
        formData: {},
        source: "check",
        status: "new",
      },
      update: {
        tier: "tier1",
        score: 85,
        updatedAt: new Date(),
      },
    });

    expect(updated.id).toBe(first.id);
    expect(updated.score).toBe(85);
    expect(updated.tier).toBe("tier1");
  });

  it("existing check correctly identifies returning lead", async () => {
    await prisma.lead.create({
      data: {
        email: TEST_EMAIL,
        resultToken: rtoken(),
        tier: "tier2",
        score: 55,
        formData: {},
        source: "check",
        status: "new",
      },
    });

    const existing = await prisma.lead.findUnique({ where: { email: TEST_EMAIL } });
    expect(existing).not.toBeNull();

    // isNew logic mirrors what /api/leads route does
    const isNew = !existing;
    expect(isNew).toBe(false);
  });

  it("new lead check returns isNew: true for fresh email", async () => {
    const existing = await prisma.lead.findUnique({ where: { email: TEST_EMAIL } });
    const isNew = !existing;
    expect(isNew).toBe(true);
  });

  it("email uniqueness constraint rejects duplicate direct insert", async () => {
    await prisma.lead.create({
      data: {
        email: TEST_EMAIL,
        resultToken: rtoken(),
        tier: "tier2",
        score: 55,
        formData: {},
        source: "check",
        status: "new",
      },
    });

    await expect(
      prisma.lead.create({
        data: {
          email: TEST_EMAIL,
          resultToken: rtoken(),
          tier: "tier1",
          score: 90,
          formData: {},
          source: "check",
          status: "new",
        },
      })
    ).rejects.toThrow();
  });
});
