import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import ChatClient from "@/components/dashboard/ChatClient"

export default async function ChatPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return <ChatClient userId={session.user.id} />
}
