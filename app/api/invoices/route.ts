import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/invoices
export async function GET(req: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")
    const q = searchParams.get("q")?.trim()
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"))
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { userId }
    if (status && status !== "ALL") where.status = status
    if (q) where.number = { contains: q, mode: "insensitive" }

    const [invoices, total, paidAgg, pendingAgg, allCount] = await Promise.all([
      db.invoice.findMany({
        where,
        orderBy: { issuedAt: "desc" },
        skip,
        take: limit,
        include: {
          payment: { select: { gateway: true, gatewayPaymentId: true } },
        },
      }),
      db.invoice.count({ where }),
      db.invoice.aggregate({ where: { userId, status: "PAID" }, _sum: { totalAmount: true } }),
      db.invoice.aggregate({ where: { userId, status: "PENDING" }, _sum: { totalAmount: true } }),
      db.invoice.count({ where: { userId } }),
    ])

    return NextResponse.json({
      data: invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      summary: {
        totalPaid: Number(paidAgg._sum.totalAmount ?? 0),
        totalPending: Number(pendingAgg._sum.totalAmount ?? 0),
        totalInvoices: allCount,
        thisMonth: invoices.filter(
          (i) => new Date(i.issuedAt).getMonth() === new Date().getMonth()
        ).reduce((s, i) => s + Number(i.totalAmount), 0),
      },
    })
  } catch (err) {
    console.error("[invoices GET]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
