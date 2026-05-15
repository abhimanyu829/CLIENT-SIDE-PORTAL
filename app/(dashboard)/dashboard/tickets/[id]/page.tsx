import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import TicketDetailClient from "./TicketDetailClient"

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const { id } = await params
  const ticket = await db.ticket.findUnique({
    where: { 
      id,
      clientId: session.user.id
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  })

  if (!ticket) {
    notFound()
  }

  return <TicketDetailClient ticket={ticket} currentUserId={session.user.id} />
}
