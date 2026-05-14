import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@prisma/client"

// GET /api/users — admin: paginated user list with search
export async function GET(req: Request) {
  try {
    const session = await auth()
    if ((session?.user as any)?.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q") ?? ""
    const roleParam = searchParams.get("role") ?? undefined
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"))
    const skip = (page - 1) * limit

    const where = {
      ...(q ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      } : {}),
      ...(roleParam ? { role: roleParam as Role } : {}),
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
          subscriptions: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: {
              status: true,
              tier: { select: { name: true } },
            },
          },
        },
      }),
      db.user.count({ where }),
    ])

    return NextResponse.json({
      data: users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[users] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
