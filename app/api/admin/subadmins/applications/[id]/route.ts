import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { reviewSubadminApplication } from "@/lib/subadmin-workforce"

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED", "SHORTLISTED"]),
  adminNotes: z.string().max(2000).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid review payload" }, { status: 400 })
  }

  const application = await reviewSubadminApplication({ id, ...parsed.data, admin })
  return NextResponse.json({ success: true, application })
}
