import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { BillingClient } from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getSession();
  if (!session || (session.role !== "attorney" && session.role !== "admin")) {
    redirect("/login");
  }

  const firm = await prisma.firmProfile.findUnique({
    where: { userId: session.userId },
  });

  const claimPayments = await prisma.leadClaimPayment.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const data = {
    firmName: firm?.firmName ?? null,
    subscriptionStatus: firm?.subscriptionStatus ?? null,
    hasStripeCustomer: !!firm?.stripeCustomerId,
    hasSubscription: !!firm?.stripeSubscriptionId,
    claimPayments: claimPayments.map((p) => ({
      id: p.id,
      leadId: p.leadId,
      amountCents: p.amountCents,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
  };

  return <BillingClient data={data} />;
}
