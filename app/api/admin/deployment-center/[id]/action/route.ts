import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdmin } from "@/lib/admin-auth"
import { runLifecycleAction, type LifecycleAction } from "@/lib/services/service-lifecycle-service"

const actionSchema = z.object({
  action: z.enum([
    "START", "STOP", "PAUSE", "RESUME", "RESTART",
    "SUSPEND", "ACTIVATE", "DEACTIVATE", "CONTINUE",
    "DELETE", "ARCHIVE", "TRANSFER", "CLONE", "RENEW", "EXTEND",
  ]),
  newUserId: z.string().optional(),
  days: z.number().int().min(1).max(3650).optional(),
  reason: z.string().max(1000).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin()
    const { id } = await params
    const body = actionSchema.parse(await req.json())

    const result = await runLifecycleAction(id, body.action as LifecycleAction, admin.userId, {
      newUserId: body.newUserId,
      days: body.days,
      reason: body.reason,
    })
    return NextResponse.json({ success: true, data: result ?? null })
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    const message = err instanceof Error ? err.message : "Failed to run action"
    console.error("[admin/deployment-center/[id]/action POST]", err)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
