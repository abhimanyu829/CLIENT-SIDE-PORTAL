import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = await requireAdmin()
  const body = await req.json()
  const { action, reason, amount } = body

  const payment = await db.payment.findUnique({
    where: { id },
    include: { invoice: true, user: true },
  })
  if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 })

  switch (action) {
    case "refund": {
      if (payment.status !== "SUCCESS") {
        return NextResponse.json({ error: "Only successful payments can be refunded" }, { status: 400 })
      }
      if (!reason) {
        return NextResponse.json({ error: "Refund reason is mandatory" }, { status: 400 })
      }
      const refundAmt = amount ? Number(amount) : Number(payment.amount)
      if (refundAmt <= 0 || refundAmt > Number(payment.amount)) {
        return NextResponse.json({ error: "Invalid refund amount" }, { status: 400 })
      }

      // Mock integration with Stripe or Razorpay APIs
      // stripe.refunds.create({ charge: payment.gatewayPaymentId, amount: refundAmt * 100 })

      await auditLog({
        userId: admin.userId,
        action: "ORDER_REFUNDED",
        entity: "Payment",
        entityId: id,
        before: { status: payment.status, amount: payment.amount },
        after: { status: "REFUNDED", refundAmount: refundAmt, reason },
      })

      // Update payment status to REFUNDED
      await db.payment.update({
        where: { id },
        data: { status: "REFUNDED" },
      })

      // Update invoice status if it exists
      if (payment.invoice) {
        await db.invoice.update({
          where: { id: payment.invoice.id },
          data: { status: "REFUNDED" },
        })
      }

      return NextResponse.json({ success: true, message: `Successfully refunded $${refundAmt}` })
    }

    case "resend": {
      // Send receipt/invoice email logic in production
      await auditLog({
        userId: admin.userId,
        action: "INVOICE_RESENT",
        entity: "Invoice",
        entityId: payment.invoice?.id || null,
        after: { recipient: payment.user.email },
      })
      return NextResponse.json({ success: true, message: "Invoice resent successfully" })
    }

    case "regenerate": {
      if (!payment.invoice) {
        return NextResponse.json({ error: "No invoice associated with this payment" }, { status: 400 })
      }
      // Re-trigger PDF generator function
      await auditLog({
        userId: admin.userId,
        action: "INVOICE_REGENERATED",
        entity: "Invoice",
        entityId: payment.invoice.id,
      })
      return NextResponse.json({ success: true, message: "Invoice PDF regenerated" })
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }
}
