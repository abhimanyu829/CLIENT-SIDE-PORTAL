import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  await requireAdmin()

  const searchParams = req.nextUrl.searchParams
  const status = searchParams.get("status") || ""
  const gateway = searchParams.get("gateway") || ""
  const from = searchParams.get("from") || ""
  const to = searchParams.get("to") || ""

  const where: any = {}

  if (status) {
    where.status = status
  }
  if (gateway) {
    where.gateway = gateway
  }
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(to) } : {}),
    }
  }

  const payments = await db.payment.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { name: true, email: true } },
    },
  })

  const headers = ["Payment ID", "Customer Name", "Customer Email", "Amount", "Currency", "Status", "Gateway", "Transaction ID", "Created At"]
  const rows = payments.map((p) => [
    p.id,
    p.user.name,
    p.user.email,
    String(p.amount),
    p.currency,
    p.status,
    p.gateway,
    p.gatewayPaymentId || "",
    p.createdAt.toISOString(),
  ])

  const csvContent = [headers.join(","), ...rows.map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n")

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="orders-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
