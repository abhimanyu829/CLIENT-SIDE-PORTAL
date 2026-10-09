import { NextRequest, NextResponse } from "next/server"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import {
  updatePlanHeader,
  createDraftVersion,
  updateDraftVersion,
  addPlanItem,
  removePlanItem,
  validatePlan,
  publishPlan,
  pausePlan,
  resumePlan,
  archivePlan,
} from "@/lib/services/plan-catalog-service"

export const dynamic = "force-dynamic"

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> } | { params: { id: string } }) {
  const gate = await adminSubscriptionGate("EDIT")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const { id } = await ctx.params
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  try {
    const data = await updatePlanHeader(id, body, gate.userId)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Plan update failed"
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> } | { params: { id: string } }) {
  const { id } = await ctx.params
  let body: { op?: unknown; versionId?: unknown; item?: unknown; cancelAtCycleEnd?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }
  const op = body?.op

  try {
    switch (op) {
      case "create-draft-version": {
        const gate = await adminSubscriptionGate("CREATE")
        if (!gate.ok) return forbidden(gate)
        const data = await createDraftVersion(id, {}, gate.userId)
        return NextResponse.json({ success: true, data })
      }
      case "update-version": {
        const gate = await adminSubscriptionGate("EDIT")
        if (!gate.ok) return forbidden(gate)
        const data = await updateDraftVersion(String(body?.versionId ?? ""), body, gate.userId)
        return NextResponse.json({ success: true, data })
      }
      case "add-item": {
        const gate = await adminSubscriptionGate("EDIT")
        if (!gate.ok) return forbidden(gate)
        const data = await addPlanItem(String(body?.versionId ?? ""), body?.item, gate.userId)
        return NextResponse.json({ success: true, data })
      }
      case "remove-item": {
        const gate = await adminSubscriptionGate("EDIT")
        if (!gate.ok) return forbidden(gate)
        const data = await removePlanItem(String(body?.versionId ?? ""), gate.userId)
        return NextResponse.json({ success: true, data })
      }
      case "validate": {
        const gate = await adminSubscriptionGate("VIEW")
        if (!gate.ok) return forbidden(gate)
        const data = await validatePlan(id, typeof body?.versionId === "string" ? body.versionId : undefined)
        return NextResponse.json({ success: true, data })
      }
      case "publish": {
        const gate = await adminSubscriptionGate("PUBLISH")
        if (!gate.ok) return forbidden(gate)
        const data = await publishPlan(id, gate.userId, typeof body?.versionId === "string" ? body.versionId : undefined)
        return NextResponse.json({ success: true, data })
      }
      case "pause": {
        const gate = await adminSubscriptionGate("PUBLISH")
        if (!gate.ok) return forbidden(gate)
        const data = await pausePlan(id, gate.userId)
        return NextResponse.json({ success: true, data })
      }
      case "resume": {
        const gate = await adminSubscriptionGate("PUBLISH")
        if (!gate.ok) return forbidden(gate)
        const data = await resumePlan(id, gate.userId)
        return NextResponse.json({ success: true, data })
      }
      case "archive": {
        const gate = await adminSubscriptionGate("DELETE")
        if (!gate.ok) return forbidden(gate)
        const data = await archivePlan(id, gate.userId)
        return NextResponse.json({ success: true, data })
      }
      default:
        return NextResponse.json({ success: false, error: "Unsupported operation" }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Operation failed"
    console.error("[admin governance plan op]", op, message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}

function forbidden(gate: { ok: false; reason: "UNAUTHENTICATED" | "FORBIDDEN"; detail?: string }) {
  return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
}