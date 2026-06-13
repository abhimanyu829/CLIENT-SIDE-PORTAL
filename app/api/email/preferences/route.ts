import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireApiAuth, UnauthorizedError } from "@/lib/api-auth"
import { db } from "@/lib/db"
import { ensureEmailPreference } from "@/lib/email/service"

const schema = z.object({
  transactional: z.boolean().optional(),
  subscriptionMail: z.boolean().optional(),
  marketing: z.boolean().optional(),
  newsletter: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
})

export async function GET() {
  try {
    const userId = await requireApiAuth()
    const preference = await ensureEmailPreference(userId)
    return NextResponse.json({ success: true, data: preference })
  } catch (error) {
    return NextResponse.json({ success: false, error: { message: "Authentication required" } }, { status: 401 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await requireApiAuth()
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Invalid preference payload" } }, { status: 422 })
    }

    const existing = await ensureEmailPreference(userId)
    const updated = await db.emailPreference.update({
      where: { userId },
      data: {
        transactional: parsed.data.transactional ?? existing.transactional,
        subscriptionMail: parsed.data.subscriptionMail ?? existing.subscriptionMail,
        marketing: parsed.data.marketing ?? existing.marketing,
        newsletter: parsed.data.newsletter ?? existing.newsletter,
        productUpdates: parsed.data.productUpdates ?? existing.productUpdates,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ success: false, error: { message: "Authentication required" } }, { status: 401 })
    }
    return NextResponse.json({ success: false, error: { message: "Unable to update preferences" } }, { status: 500 })
  }
}
