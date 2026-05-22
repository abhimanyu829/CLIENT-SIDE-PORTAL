import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const userId = session.user.id

    const invoices = await db.invoice.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      take: 500,
    })

    const rows = [
      ["Invoice Number", "Date", "Amount", "Tax", "Currency", "Status"].join(","),
      ...invoices.map((inv) =>
        [
          inv.number,
          new Date(inv.issuedAt).toLocaleDateString(),
          Number(inv.totalAmount).toFixed(2),
          Number(inv.taxAmount).toFixed(2),
          inv.currency,
          inv.status,
        ].join(",")
      ),
    ].join("\n")

    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  } catch (err) {
    console.error("[invoices/export]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
