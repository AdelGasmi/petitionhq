import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as {
    firmName: string;
    website?: string;
    specialties: string[];
    plan: "pilot" | "standard";
  };

  // Pricing-V3: credits removed. Pilot = manual approval, Standard = Stripe sub.
  // trialCredits/purchasedCredits columns still exist in schema but are no longer
  // read or written. Will drop in a future migration.
  const firm = await prisma.firmProfile.upsert({
    where: { userId: session.userId },
    update: {
      firmName: body.firmName,
      specialties: body.specialties,
    },
    create: {
      userId: session.userId,
      firmName: body.firmName,
      specialties: body.specialties,
      networkTier: "standard",
    },
  });

  if (body.plan === "standard" && STRIPE_PRICES.seat) {
    let customerId = firm.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.email,
        name: body.firmName,
        metadata: { userId: session.userId },
      });
      customerId = customer.id;
      await prisma.firmProfile.update({
        where: { userId: session.userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: STRIPE_PRICES.seat, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/network/leads?seat=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/onboarding/firm`,
      metadata: { userId: session.userId, type: "seat" },
    });

    return NextResponse.json({ ok: true, checkoutUrl: checkoutSession.url });
  }

  return NextResponse.json({ ok: true });
}
