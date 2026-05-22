import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    
    const notifications = await db.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20
    })

    return NextResponse.json({ data: notifications })
  } catch (err) {
    console.error("[notifications GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    // Basic API Key check for internal service usage
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
      const session = await auth()
      if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { userId, type, title, body, actionUrl } = await req.json()
    if (!userId || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

    const notification = await db.notification.create({
      data: {
        userId,
        type: type ?? "SYSTEM",
        title,
        body,
        actionUrl,
      }
    })

    // Optionally trigger Pusher
    if (process.env.PUSHER_APP_ID) {
      try {
        const Pusher = (await import("pusher")).default
        const pusher = new Pusher({
          appId: process.env.PUSHER_APP_ID,
          key: process.env.PUSHER_KEY!,
          secret: process.env.PUSHER_SECRET!,
          cluster: process.env.PUSHER_CLUSTER ?? "ap2",
          useTLS: true,
        })
        await pusher.trigger(`private-user-${userId}`, "notification.new", notification)
      } catch {}
    }

    return NextResponse.json({ data: notification }, { status: 201 })
  } catch (err) {
    console.error("[notifications POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
