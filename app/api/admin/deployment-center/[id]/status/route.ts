import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { advanceDeploymentStatus, completeDeployment } from "@/lib/services/service-lifecycle-service"
import type { ServiceDeploymentStatus } from "@prisma/client"

const statusSchema = z.object({
  status: z.enum(["PENDING", "PREPARING", "DEPLOYING", "DATABASE_CONFIG", "GENERATING_CREDENTIALS", "QUALITY_CHECK", "COMPLETED", "FAILED"]),
  notes: z.string().max(2000).optional(),
  config: z.record(z.string(), z.any()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = statusSchema.parse(await req.json())

    if (body.status === "COMPLETED") {
      await completeDeployment(id, body.config ?? {}, admin.userId, body.notes)
    } else {
      await advanceDeploymentStatus(id, body.status as ServiceDeploymentStatus, admin.userId, body.notes)
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    const message = err instanceof Error ? err.message : "Failed to update deployment"
    console.error("[admin/deployment-center/[id]/status PATCH]", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
