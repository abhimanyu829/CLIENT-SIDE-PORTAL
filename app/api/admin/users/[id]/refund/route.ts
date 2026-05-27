import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { processRefund } from "@/lib/services/refund-service"

function isAdmin(session: any) {
  const role = session?.user?.role
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN"
}

const refundSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.number().positive().optional(),
  reason: z.string().max(500).optional(),
})

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: userId } = await context.params

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !isAdmin(session)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Admin only" } }, { status: 403 })
    }

    const parsed = refundSchema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid input", details: parsed.error.flatten() } },
        { status: 422 }
      )
    }
    const { paymentId, amount, reason } = parsed.data

    const payment = await db.payment.findUnique({ where: { id: paymentId } })
    if (!payment || payment.userId !== userId) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Payment not found for this user" } }, { status: 404 })
    }

    const result = await processRefund(
      paymentId,
      amount ?? Number(payment.amount),
      reason ?? "Admin manual refund",
      session.user.id
    )
    if (!result.success) {
      return NextResponse.json({ success: false, error: { code: "REFUND_FAILED", message: result.error } }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        paymentId,
        refundedAmount: result.amount,
        currency: payment.currency,
        gatewayRefundId: result.refundId,
      },
    })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/users/[id]/refund")
    return NextResponse.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } }, { status: 500 })
  }
}
