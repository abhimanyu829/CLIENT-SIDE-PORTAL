import { NextResponse } from "next/server"
import { z } from "zod"
import { requireSuperAdmin } from "@/lib/admin-auth"
import { logSubadminActivity } from "@/lib/subadmin-workforce"
import { db } from "@/lib/db"

function prisma() {
  return db as any
}

const reviewSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNotes: z.string().max(2000).optional(),
})

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireSuperAdmin()
  const { id } = await params
  const parsed = reviewSchema.safeParse(await req.json().catch(() => null))

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid approval review payload" }, { status: 400 })
  }

  const approval = await prisma().subadminApprovalRequest.update({
    where: { id },
    data: {
      status: parsed.data.status,
      reviewNotes: parsed.data.reviewNotes ?? null,
      reviewedById: admin.userId,
      reviewedAt: new Date(),
    },
  })

  await logSubadminActivity({
    subadminId: approval.subadminId,
    actorId: admin.userId,
    action: `APPROVAL_REQUEST_${parsed.data.status}`,
    entity: "SubadminApprovalRequest",
    entityId: approval.id,
    metadata: { reviewNotes: parsed.data.reviewNotes },
  })

  return NextResponse.json({ success: true, approval })
}
