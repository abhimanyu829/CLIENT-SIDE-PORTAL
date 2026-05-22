import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import TicketsClient from "@/components/dashboard/TicketsClient"

export default async function TicketsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const tickets = await db.ticket.findMany({
    where: { clientId: session.user.id },
    orderBy: { updatedAt: "desc" },
  })

  return <TicketsClient initialTickets={tickets as any} />
}
