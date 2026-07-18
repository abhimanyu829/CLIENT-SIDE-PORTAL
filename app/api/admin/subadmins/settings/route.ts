import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { getPortalSetting, upsertPortalSetting } from "@/lib/subadmin-workforce"

const settingsSchema = z.object({
  enabled: z.boolean(),
  applicationsOpen: z.boolean(),
  portalPath: z.string().min(2).max(80),
})

export async function GET() {
  await requireSuperAdmin()
  const setting = await getPortalSetting()
  return NextResponse.json({ setting })
}

export async function PATCH(req: Request) {
  const admin = await requireSuperAdmin()
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid portal setting payload" }, { status: 400 })
  }

  const setting = await upsertPortalSetting({ ...parsed.data, admin })
  return NextResponse.json({ success: true, setting })
}
