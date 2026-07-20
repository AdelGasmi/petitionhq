import { NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/firms — list all firms with linked attorney data.
 * Returns firm-level view for admin gatekeeper page.
 */
async function _GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const firms = await prisma.firmProfile.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          verified: true,
          suspended: true,
          createdAt: true,
          subscriptionStatus: true,
          _count: {
            select: {
              claimedLeads: true,
              attorneyCases: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const result = firms.map((f) => ({
    id: f.id,
    userId: f.userId,
    firmName: f.firmName,
    networkTier: f.networkTier,
    subscriptionStatus: f.subscriptionStatus,
    stripeCustomerId: f.stripeCustomerId,
    stripeSubscriptionId: f.stripeSubscriptionId,
    specialties: f.specialties,
    calendlyUrl: f.calendlyUrl,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
    attorney: {
      id: f.user.id,
      name: f.user.name,
      email: f.user.email,
      verified: f.user.verified,
      suspended: f.user.suspended,
      createdAt: f.user.createdAt.toISOString(),
      userSubscriptionStatus: f.user.subscriptionStatus,
      claimedLeads: f.user._count.claimedLeads,
      activeCases: f.user._count.attorneyCases,
    },
  }));

  return NextResponse.json(result);
}

export const GET = withRoute(_GET);
