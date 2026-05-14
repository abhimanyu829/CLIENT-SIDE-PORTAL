import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import TicketsClient from "./TicketsClient"

export default async function TicketsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const tickets = await db.ticket.findMany({
    where: { clientId: session.user.id },
    orderBy: { createdAt: "desc" }
  })

  return <TicketsClient initialTickets={tickets} />
}
