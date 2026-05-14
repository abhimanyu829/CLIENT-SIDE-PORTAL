import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { hash } from "bcryptjs"

// GET /api/users/[id] — get a single user (admin or self)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = (session.user as any).role === "ADMIN"
    const isSelf = session.user.id === id

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        avatarUrl: true,
        phone: true,
        timezone: true,
        createdAt: true,
        subscriptions: {
          take: 1,
          orderBy: { createdAt: "desc" as const },
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true,
            cancelAtPeriodEnd: true,
            tier: { select: { name: true, price: true, currency: true } },
          },
        },
      },
    })

    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    return NextResponse.json({ data: user })
  } catch (err) {
    console.error("[users/[id]] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PATCH /api/users/[id] — update user profile or admin fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = (session.user as any).role === "ADMIN"
    const isSelf = session.user.id === id

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()

    // Non-admins can only update personal fields (bio removed — not in schema)
    const allowedSelfFields = ["name", "phone", "timezone", "avatarUrl"]
    const adminOnlyFields = ["role", "email"]

    const data: Record<string, unknown> = {}

    for (const field of allowedSelfFields) {
      if (field in body) data[field] = body[field]
    }

    if (isAdmin) {
      for (const field of adminOnlyFields) {
        if (field in body) data[field] = body[field]
      }
      if (body.password) {
        data.passwordHash = await hash(body.password, 12)
      }
    }

    const updated = await db.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, avatarUrl: true },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error("[users/[id]] PATCH:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// DELETE /api/users/[id] — admin-only hard delete
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await auth()
    if ((session?.user as any)?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[users/[id]] DELETE:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
