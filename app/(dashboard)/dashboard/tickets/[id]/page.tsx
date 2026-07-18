import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import TicketDetailClient from "@/components/dashboard/TicketDetailClient"
import { serializePrisma } from "@/lib/serialize-prisma"

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  
  const { id } = await params

  const ticket = await db.ticket.findUnique({
    where: { id, clientId: session.user.id },
  })
  if (!ticket) redirect("/dashboard/tickets")

  return <TicketDetailClient ticket={serializePrisma(ticket)} userId={session.user.id} />
}
