import { NextRequest, NextResponse } from "next/server"
import { ReconciliationMode } from "@prisma/client"
import { adminSubscriptionGate } from "@/lib/admin-subscription-guard"
import { db } from "@/lib/db"
import { runReconciliation, repairFindingById, SAFE_AUTO_REPAIRS } from "@/lib/services/reconciliation/engine"

export const dynamic = "force-dynamic"

const VALID_MODES = new Set(Object.values(ReconciliationMode))

export async function GET(req: NextRequest) {
  const gate = await adminSubscriptionGate("VIEW")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  const sp = req.nextUrl.searchParams
  try {
    const [runs, findings] = await Promise.all([
      db.reconciliationRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
      db.reconciliationFinding.findMany({
        where: sp.get("status") ? { status: sp.get("status") as never } : {},
        orderBy: [{ severity: "asc" }, { lastObservedAt: "desc" }],
        take: 50,
      }),
    ])
    return NextResponse.json({
      success: true,
      data: {
        runs: runs.map((r) => ({
          id: r.id,
          mode: r.mode,
          status: r.status,
          scope: r.scope,
          scanned: r.scanned,
          findings: r.findingsCount,
          repaired: r.repairedCount,
          proposed: r.skippedCount,
          errors: r.errorCount,
          startedAt: r.startedAt.toISOString(),
          finishedAt: r.finishedAt?.toISOString() ?? null,
          errorCode: r.errorCode,
        })),
        findings: findings.map((f) => ({
          id: f.id,
          category: f.category,
          severity: f.severity,
          entityType: f.entityType,
          entityId: f.entityId,
          status: f.status,
          proposedAction: f.proposedAction,
          repairable: !!f.proposedAction && SAFE_AUTO_REPAIRS.has(f.proposedAction as never),
          observedValue: f.observedValue,
          expectedValue: f.expectedValue,
          resolutionNote: f.resolutionNote,
          attempts: f.attempts,
          firstObservedAt: f.firstObservedAt.toISOString(),
          lastObservedAt: f.lastObservedAt.toISOString(),
        })),
      },
    })
  } catch (err) {
    console.error("[reconciliation GET]", err)
    return NextResponse.json({ success: false, error: "Failed to load reconciliation data" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await adminSubscriptionGate("APPROVE")
  if (!gate.ok) {
    return NextResponse.json({ success: false, error: gate.reason === "UNAUTHENTICATED" ? "Unauthorized" : "Forbidden" }, { status: gate.reason === "UNAUTHENTICATED" ? 401 : 403 })
  }
  let body: { action?: unknown; mode?: unknown; findingId?: unknown; batchSize?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
  }

  try {
    if (body?.action === "run") {
      const mode = typeof body.mode === "string" && VALID_MODES.has(body.mode as ReconciliationMode)
        ? (body.mode as ReconciliationMode)
        : ReconciliationMode.DETECT_ONLY
      const batchSize = typeof body.batchSize === "number" ? body.batchSize : undefined
      const result = await runReconciliation({ mode, actorId: gate.userId, batchSize, correlationId: `admin-${Date.now()}` })
      return NextResponse.json({ success: true, data: result })
    }
    if (body?.action === "repair") {
      const findingId = typeof body.findingId === "string" ? body.findingId : ""
      if (!findingId) return NextResponse.json({ success: false, error: "findingId is required" }, { status: 400 })
      const result = await repairFindingById(findingId, gate.userId)
      return NextResponse.json({ success: true, data: result })
    }
    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reconciliation operation failed"
    console.error("[reconciliation POST]", message)
    return NextResponse.json({ success: false, error: message }, { status: 400 })
  }
}
