import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function _POST(_req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
    select: { stripeCustomerId: true },
  });

  if (!firm?.stripeCustomerId) {
    return NextResponse.json({ error: "No billing account" }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: firm.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/network/billing`,
  });

  return NextResponse.json({ ok: true, url: portalSession.url });
}

export const POST = withRoute(_POST);
