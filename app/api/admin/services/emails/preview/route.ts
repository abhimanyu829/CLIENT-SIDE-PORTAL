import { NextRequest, NextResponse } from "next/server"
import { render } from "@react-email/render"
import { z } from "zod"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"
import { sendEmailPreview } from "@/lib/email/service"
import { logger } from "@/lib/logger"

const schema = z.object({
  templateName: z.string().min(2),
  payload: z.record(z.any()).default({}),
})

export async function POST(req: NextRequest) {
  try {
    await requireServiceOperationsAccess("emails")
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: { message: "Invalid preview request" } }, { status: 422 })
    }

    const react = await sendEmailPreview(parsed.data.templateName, {
      ...parsed.data.payload,
      serviceScope: "SERVICES",
    })
    const html = await render(react)
    return NextResponse.json({ success: true, html })
  } catch (error) {
    logger.error({ error }, "POST /api/admin/services/emails/preview")
    return NextResponse.json({ success: false, error: { message: "Unable to render service email preview" } }, { status: 500 })
  }
}
