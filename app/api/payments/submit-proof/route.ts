import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { OrderStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import fs from "fs"
import path from "path"
import { notifyManualPaymentAdmin, logManualPaymentAudit, formatMoney } from "@/lib/services/manual-payment-verification"

const submitProofSchema = z.object({
  orderId: z.string(),
  utrNumber: z.string().min(12).max(22), // UTR/transaction refs vary: IMPS=12, UPI/NEFT can be up to 22 chars
  claimedAmount: z.number().positive().optional(),
  screenshot: z.string().optional().nullable(), // base64 data url
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 })
    }

    let rawJson: any
    try {
      rawJson = await req.json()
    } catch (parseErr) {
      console.error("[SUBMIT PROOF JSON PARSE ERROR]", parseErr)
      return NextResponse.json(
        { success: false, error: { message: "Invalid request payload or image size is too large. Please upload a smaller screenshot." } },
        { status: 400 }
      )
    }

    const body = submitProofSchema.parse(rawJson)

    // 1. Fetch order and the current verification row atomically by ownership
    const order = await db.order.findFirst({
      where: { id: body.orderId, userId: session.user.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, slug: true } },
            tier: { select: { id: true, name: true, interval: true } },
          },
        },
      },
    })

    if (!order) {
      return NextResponse.json({ success: false, error: { message: "Order not found" } }, { status: 404 })
    }

    const claimedAmount = body.claimedAmount ?? Number(order.grandTotal)

    const existingVerification = await db.paymentVerification.findUnique({
      where: { orderId: order.id },
    })

    if (existingVerification && existingVerification.verificationStatus === "APPROVED") {
      return NextResponse.json({ success: false, error: { message: "This order has already been verified." } }, { status: 400 })
    }

    // 2. Verify UTR is unique across the platform, unless it belongs to this exact order
    const existingUtr = await db.paymentVerification.findUnique({
      where: { utrNumber: body.utrNumber }
    })

    if (existingUtr && existingUtr.orderId !== order.id) {
      return NextResponse.json({ success: false, error: { message: "This UTR number has already been used. Please submit a unique UTR." } }, { status: 400 })
    }

    if (order.status !== "PENDING" && order.status !== "DRAFT" && order.status !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ success: false, error: { message: "Order cannot be verified at this stage" } }, { status: 400 })
    }

    // 3. Save screenshot to public/uploads
    let screenshotUrl: string | null = null
    try {
      const matches = body.screenshot?.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
      if (matches && matches.length === 3) {
        const ext = matches[1] === "jpeg" ? "jpg" : matches[1]
        const data = matches[2]
        const buffer = Buffer.from(data, "base64")
        const fileName = `utr_${body.utrNumber}_${Date.now()}.${ext}`
        
        const uploadsDir = path.join(process.cwd(), "public", "uploads", "utr")
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true })
        }
        
        fs.writeFileSync(path.join(uploadsDir, fileName), buffer)
        screenshotUrl = `/uploads/utr/${fileName}`
      }
    } catch (err) {
      console.error("Error saving screenshot", err)
      // We can still proceed even if screenshot fails, or we can reject
    }

    // 4. Create or update the Payment Verification Record and update the order status
    let savedVerificationId = existingVerification?.id
    await db.$transaction(async (tx) => {
      const verification = existingVerification
        ? await tx.paymentVerification.update({
            where: { id: existingVerification.id },
            data: {
              utrNumber: body.utrNumber,
              claimedAmount,
              screenshotUrl,
              verificationStatus: "AWAITING_VERIFICATION",
              // Fresh review cycle: clear all prior review state so a resubmit
              // after DENY is judged on its own merits (stale attempt counts
              // would otherwise trigger instant auto-fail on first mismatch).
              mismatchReason: null,
              lastReviewedAt: null,
              reviewAttemptCount: 0,
              adminTransactionId: null,
              adminActualAmount: null,
              verifiedAt: null,
              verifiedBy: null,
            },
          })
        : await tx.paymentVerification.create({
            data: {
              orderId: order.id,
              userId: session.user.id,
              utrNumber: body.utrNumber,
              claimedAmount,
              screenshotUrl,
              verificationStatus: "AWAITING_VERIFICATION",
            },
          })

      savedVerificationId = verification.id

      await tx.order.update({
        where: { id: order.id },
        data: { status: "AWAITING_VERIFICATION" }
      })
    })

    const snapshot = {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      grandTotal: Number(order.grandTotal),
      currency: order.currency,
      user: order.user,
      items: order.items,
    }

    const verificationSnapshot = {
      id: savedVerificationId ?? "",
      orderId: order.id,
      userId: session.user.id,
      utrNumber: body.utrNumber,
      claimedAmount,
      screenshotUrl,
      reviewAttemptCount: 0, // review state was reset above — fresh cycle
      mismatchReason: null,
      verificationStatus: "AWAITING_VERIFICATION",
    }

    await notifyManualPaymentAdmin({
      order: snapshot,
      verification: verificationSnapshot,
    }).catch((error) => {
      console.error("[SUBMIT PROOF] Failed to notify admin", error)
    })

    await logManualPaymentAudit({
      action: "manual_payment.proof_submitted",
      orderId: order.id,
      orderNumber: order.orderNumber,
      userId: session.user.id,
      verificationId: savedVerificationId ?? order.id,
      after: {
        utrNumber: body.utrNumber,
        claimedAmount: formatMoney(claimedAmount),
        screenshotUrl,
        verificationStatus: "AWAITING_VERIFICATION",
      },
      req,
    }).catch(() => {})

    return NextResponse.json({ success: true, data: { status: "AWAITING_VERIFICATION" } })

  } catch (err: any) {
    console.error("[SUBMIT PROOF ERROR]", err)
    return NextResponse.json({ success: false, error: { message: err.message || "Failed to submit proof" } }, { status: 500 })
  }
}
