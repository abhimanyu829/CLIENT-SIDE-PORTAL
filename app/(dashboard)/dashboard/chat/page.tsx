import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ChatClient from "./ChatClient"

export default async function LiveChatPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/auth/signin")

  const rooms = await db.chatRoom.findMany({
    where: { userId: session.user.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { createdAt: "desc" }
  })

  // If no rooms exist, create one
  if (rooms.length === 0) {
    const newRoom = await db.chatRoom.create({
      data: {
        userId: session.user.id,
        isActive: true,
        messages: {
          create: {
            senderId: "system",
            senderType: "AGENT",
            content: "Hi! You are chatting with AI Support. How can I assist you today?",
            isRead: false
          }
        }
      },
      include: {
        messages: true
      }
    })
    rooms.push(newRoom)
  }

  return <ChatClient initialRooms={rooms} currentUserId={session.user.id} />
}
