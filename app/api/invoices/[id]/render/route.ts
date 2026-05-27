import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { user: true, payment: true, order: { include: { items: true } }, subscription: { include: { tier: true, product: true } } },
  })
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 })

  const role = (session.user as any).role
  const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN" || role === "ADMIN" || role === "STAFF"
  if (!isAdmin && invoice.userId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const rows = (invoice.lineItems as Array<{ name?: string; quantity?: number; unitPrice?: string }> | null) ?? []
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${invoice.number}</title>
  <style>body{font-family:Arial,sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}.total{font-weight:700;font-size:18px}</style></head>
  <body><h1>NexusAI Invoice</h1><p><strong>${invoice.number}</strong></p><p>${invoice.user.name} &lt;${invoice.user.email}&gt;</p>
  <p>Status: ${invoice.status} | Date: ${invoice.issuedAt.toISOString().slice(0,10)}</p>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th></tr></thead><tbody>
  ${rows.map((item) => `<tr><td>${item.name ?? "NexusAI item"}</td><td>${item.quantity ?? 1}</td><td>${item.unitPrice ?? ""}</td></tr>`).join("")}
  </tbody></table><p>Tax: ${invoice.taxAmount} ${invoice.currency}</p><p class="total">Total: ${invoice.totalAmount} ${invoice.currency}</p>
  <p>Transaction: ${invoice.payment.gatewayPaymentId ?? invoice.payment.id}</p></body></html>`

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${invoice.number}.html"`,
    },
  })
}
