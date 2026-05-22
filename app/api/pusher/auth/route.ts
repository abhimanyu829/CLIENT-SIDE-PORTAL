import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Only import Pusher when actually needed
    const Pusher = (await import("pusher")).default
    const pusherServer = new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      cluster: process.env.PUSHER_CLUSTER ?? "ap2",
      useTLS: true,
    })

    const body = await req.text()
    const params = new URLSearchParams(body)
    const socketId = params.get("socket_id")!
    const channelName = params.get("channel_name")!

    // Only allow users to auth their own private channel
    const expectedChannel = `private-user-${session.user.id}`
    if (channelName !== expectedChannel && channelName !== "private-dashboard") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName)
    return NextResponse.json(authResponse)
  } catch (err) {
    console.error("[pusher/auth]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
