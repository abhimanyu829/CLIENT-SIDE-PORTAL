import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { buildReceiptPdf, type InvoicePdfInput } from "@/lib/invoice-pdf"

// GET /api/invoices/[id]/receipt
// Payment receipt PDF for a confirmed payment. Reuses the existing invoice
// record and payment data — no second billing system, no amount recalculation.
// Access control mirrors the invoice download route: owner or admin only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        payment: { select: { gatewayPaymentId: true, id: true, gateway: true, paidAt: true, status: true } },
        order: {
          select: {
            orderNumber: true, paidAt: true,
            items: {
              select: {
                name: true, quantity: true, unitPrice: true,
                tier: { select: { name: true, interval: true } },
                product: { select: { category: true } },
              },
            },
          },
        },
        subscription: { select: { currentPeriodStart: true, currentPeriodEnd: true, tier: { select: { name: true, interval: true } }, product: { select: { name: true } } } },
      },
    })

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
    }

    const role = (session.user as any).role
    const isAdmin = role === "SUPER_ADMIN" || role === "SUB_ADMIN" || role === "ADMIN" || role === "STAFF"
    if (!isAdmin && invoice.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const pdfInput: InvoicePdfInput = {
      number: invoice.number,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      userName: invoice.user?.name,
      userEmail: invoice.user?.email,
      userPhone: invoice.user?.phone,
      orderNumber: invoice.order?.orderNumber,
      purchaseDate: invoice.order?.paidAt ?? invoice.issuedAt,
      paymentMethod: invoice.payment?.gateway ?? null,
      transactionRef: invoice.payment?.gatewayPaymentId ?? invoice.payment?.id ?? null,
      paidAt: invoice.payment?.paidAt ?? invoice.order?.paidAt ?? null,
      subscription: invoice.subscription
        ? {
            planName: invoice.subscription.tier?.name,
            productName: invoice.subscription.product?.name,
            interval: invoice.subscription.tier?.interval,
            startDate: invoice.subscription.currentPeriodStart,
            endDate: invoice.subscription.currentPeriodEnd,
          }
        : null,
      lineItems: (invoice.lineItems as any[]) ?? invoice.order?.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        tierName: item.tier?.name,
        interval: item.tier?.interval,
        category: item.product?.category,
      })) ?? [],
      taxAmount: Number(invoice.taxAmount ?? 0),
      totalAmount: Number(invoice.totalAmount),
      currency: invoice.currency,
    }

    const pdf = buildReceiptPdf(pdfInput)
    const filename = `RECEIPT-${invoice.number || "payment"}.pdf`

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (err) {
    console.error("[invoices/receipt] GET:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
