import { NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// POST /api/billing/subscribe — Stripe subscription for the $99/mo
// attorney seat. Required to access /network features and claim leads.
async function _POST(_req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!STRIPE_PRICES.seat) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const firm = await prisma.firmProfile.findUnique({ where: { userId: session.userId } });

  let customerId = firm?.stripeCustomerId ?? undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.email,
      name: firm?.firmName ?? session.name,
      metadata: { userId: session.userId },
    });
    customerId = customer.id;
    await prisma.firmProfile.upsert({
      where: { userId: session.userId },
      update: { stripeCustomerId: customerId },
      create: { userId: session.userId, stripeCustomerId: customerId },
    });
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: STRIPE_PRICES.seat, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/network/leads?seat=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/network/billing`,
    metadata: { userId: session.userId, type: "seat" },
  });

  return NextResponse.json({ ok: true, checkoutUrl: checkoutSession.url });
}

export const POST = withRoute(_POST);
