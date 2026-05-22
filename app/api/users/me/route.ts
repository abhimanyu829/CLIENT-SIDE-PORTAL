import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        phone: true,
        timezone: true,
        role: true,
        isVerified: true,
        twoFactorEnabled: true,
        notifPrefs: true,
        createdAt: true,
        apiKeys: {
          where: { isActive: true },
          select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
        },
      },
    })

    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ data: user })
  } catch (err) {
    console.error("[users/me GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { name, phone, timezone, notifPrefs } = await req.json()

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (timezone !== undefined) data.timezone = timezone
    if (notifPrefs !== undefined) data.notifPrefs = notifPrefs

    const updated = await db.user.update({
      where: { id: session.user.id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        phone: true,
        timezone: true,
        notifPrefs: true,
      },
    })

    // Create audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: "USER_PROFILE_UPDATED",
        entity: "User",
        entityId: session.user.id,
        afterJson: data as Record<string, unknown>,
      },
    }).catch(() => {})

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[users/me PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
