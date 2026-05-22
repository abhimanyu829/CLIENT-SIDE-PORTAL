import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import SubscriptionsClient from "@/components/dashboard/SubscriptionsClient"

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const [subscriptions, products] = await Promise.all([
    db.subscription.findMany({
      where: { userId: session.user.id },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
    db.product.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { type: "asc" },
    }),
  ])

  return (
    <SubscriptionsClient 
      initialSubscriptions={subscriptions as any}
      availableProducts={products as any} 
    />
  )
}
