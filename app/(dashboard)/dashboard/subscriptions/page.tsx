import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import SubscriptionsClient from "./SubscriptionsClient"

export default async function SubscriptionsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const subscriptions = await db.subscription.findMany({
    where: { userId: session.user.id },
    include: {
      product: true,
      tier: true,
    },
    orderBy: { createdAt: "desc" }
  })

  const invoices = await db.invoice.findMany({
    where: { userId: session.user.id },
    orderBy: { issuedAt: "desc" }
  })

  return <SubscriptionsClient subscriptions={subscriptions} invoices={invoices} />
}
