import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import { markOrderPaid, fulfillOrder } from "@/lib/services/enterprise-commerce-service"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await requireAdmin()
    const verification = await db.paymentVerification.findUnique({ where: { id } })
    if (!verification) return NextResponse.json({ success: false, error: { message: "Not found" } }, { status: 404 })

    if (verification.verificationStatus !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ success: false, error: { message: "Already processed" } }, { status: 400 })
    }

    await db.paymentVerification.update({
      where: { id: verification.id },
      data: { verificationStatus: "APPROVED", verifiedAt: new Date() }
    })

    // Mark paid and fulfill
    await markOrderPaid(verification.orderId, `manual_${verification.utrNumber}`, `manual_${verification.orderId}`)
    await fulfillOrder(verification.orderId).catch(err => console.error("Fulfill error:", err))

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[APPROVE UTR]", err)
    return NextResponse.json({ success: false, error: { message: err.message } }, { status: 500 })
  }
}
