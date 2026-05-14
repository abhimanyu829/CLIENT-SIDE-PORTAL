import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { env } from "@/lib/env"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get("x-razorpay-signature")

    if (!signature) {
      return NextResponse.json(
        { success: false, error: { code: "NO_SIGNATURE", message: "Missing signature" } },
        { status: 400 }
      )
    }

    const expectedSignature = crypto
      .createHmac("sha256", env.RAZORPAY_WEBHOOK_SECRET ?? "")
      .update(rawBody)
      .digest("hex")

    if (expectedSignature !== signature) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_SIGNATURE", message: "Invalid signature" } },
        { status: 400 }
      )
    }

    const event = JSON.parse(rawBody)

    switch (event.event) {
      case "order.paid":
      case "payment.captured": {
        const paymentData = event.payload.payment.entity
        const orderId = paymentData.order_id

        if (orderId) {
          await db.payment.updateMany({
            where: { gatewayOrderId: orderId, gateway: "RAZORPAY" },
            data: {
              status: "SUCCESS",
              gatewayPaymentId: paymentData.id,
              paidAt: new Date(),
            },
          })
        }
        break
      }
      case "payment.failed": {
        const paymentData = event.payload.payment.entity
        const orderId = paymentData.order_id

        if (orderId) {
          await db.payment.updateMany({
            where: { gatewayOrderId: orderId, gateway: "RAZORPAY" },
            data: {
              status: "FAILED",
              failureReason: paymentData.error_description || "Payment failed",
            },
          })
        }
        break
      }
      case "subscription.charged": {
        const subscriptionData = event.payload.subscription.entity
        const paymentData = event.payload.payment.entity

        if (subscriptionData.id) {
          const sub = await db.subscription.findUnique({
            where: { razorpaySubId: subscriptionData.id },
          })
          
          if (sub) {
            // Create a payment record
            await db.payment.create({
              data: {
                userId: sub.userId,
                subscriptionId: sub.id,
                amount: paymentData.amount / 100, // Assuming Razorpay sends amount in smallest unit
                currency: paymentData.currency,
                status: "SUCCESS",
                gateway: "RAZORPAY",
                gatewayPaymentId: paymentData.id,
                paidAt: new Date(),
              }
            })
            
            // Optionally update subscription period here depending on logic
          }
        }
        break
      }
      default:
        logger.info({ event: event.event }, "Unhandled Razorpay webhook event")
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    logger.error({ err: error }, "Razorpay webhook handler failed")
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    )
  }
}
