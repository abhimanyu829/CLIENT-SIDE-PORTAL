import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { enqueueEmail } from "@/lib/email/service"
import { logger } from "@/lib/logger"

const schema = z.object({
  recipient: z.string().email(),
  templateName: z.string().min(2),
  subject: z.string().min(2).max(160),
  payload: z.record(z.any()).default({}),
})

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin()
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Invalid test email payload" } }, { status: 422 })
    }

    const queue = await enqueueEmail({
      emailType: "ADMIN_BROADCAST",
      recipient: parsed.data.recipient,
      subject: parsed.data.subject,
      templateName: parsed.data.templateName,
      payload: {
        ...parsed.data.payload,
        name: admin.name,
        unsubscribeToken: parsed.data.payload.unsubscribeToken ?? "",
      },
      userId: admin.userId,
      queueNow: true,
    })

    return NextResponse.json({ success: true, data: queue })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/emails/test")
    return NextResponse.json({ success: false, error: { message: "Unable to send test email" } }, { status: 500 })
  }
}
