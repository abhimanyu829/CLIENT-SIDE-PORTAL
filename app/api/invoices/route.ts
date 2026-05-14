import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/invoices — list invoices for authenticated user
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "10"))
    const skip = (page - 1) * limit

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN"

    const where = isAdmin ? {} : { userId: session.user.id }

    const [invoices, total] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { name: true, email: true } },
          payment: { select: { gateway: true, status: true } },
        },
      }),
      db.invoice.count({ where }),
    ])

    return NextResponse.json({
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    })
  } catch (err) {
    console.error("[invoices] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
