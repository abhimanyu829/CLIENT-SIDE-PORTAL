import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { OrderStatus } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import fs from "fs"
import path from "path"

const submitProofSchema = z.object({
  orderId: z.string(),
  utrNumber: z.string().min(12).max(22), // UTR/transaction refs vary: IMPS=12, UPI/NEFT can be up to 22 chars
  screenshot: z.string(), // base64 data url
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: { message: "Unauthorized" } }, { status: 401 })
    }

    const body = submitProofSchema.parse(await req.json())

    // 1. Verify UTR is unique
    const existingUtr = await db.paymentVerification.findUnique({
      where: { utrNumber: body.utrNumber }
    })
    
    if (existingUtr) {
      return NextResponse.json({ success: false, error: { message: "This UTR number has already been used. Please submit a unique UTR." } }, { status: 400 })
    }

    // 2. Fetch order
    const order = await db.order.findUnique({
      where: { id: body.orderId, userId: session.user.id }
    })

    if (!order) {
      return NextResponse.json({ success: false, error: { message: "Order not found" } }, { status: 404 })
    }

    if (order.status !== "PENDING" && order.status !== "DRAFT" && order.status !== "AWAITING_VERIFICATION") {
      return NextResponse.json({ success: false, error: { message: "Order cannot be verified at this stage" } }, { status: 400 })
    }

    // 3. Save screenshot to public/uploads
    let screenshotUrl: string | null = null
    try {
      const matches = body.screenshot.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/)
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

    // 4. Create Payment Verification Record and Update Order
    await db.$transaction(async (tx) => {
      await tx.paymentVerification.create({
        data: {
          orderId: order.id,
          userId: session.user.id,
          utrNumber: body.utrNumber,
          screenshotUrl,
          verificationStatus: "AWAITING_VERIFICATION"
        }
      })

      await tx.order.update({
        where: { id: order.id },
        data: { status: "AWAITING_VERIFICATION" }
      })
    })

    return NextResponse.json({ success: true, data: { status: "AWAITING_VERIFICATION" } })

  } catch (err: any) {
    console.error("[SUBMIT PROOF ERROR]", err)
    return NextResponse.json({ success: false, error: { message: err.message || "Failed to submit proof" } }, { status: 500 })
  }
}
