import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import TicketDetailClient from "./TicketDetailClient"

export default async function TicketDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const ticket = await db.ticket.findUnique({
    where: { 
      id: params.id,
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
