/**
 * app/api/admin/agent-connections/[id]/autonomy/route.ts
 *
 * Phase 7 — human-only administration of a connection's autonomy policy.
 * SUPER_ADMIN only (existing requireSuperAdmin). There is no gateway route,
 * MCP tool or agent capability that can read or write autonomy policy, so
 * an agent can never raise its own autonomy.
 *
 * Changing the policy bumps its version; because the version is part of
 * every approval's binding digest, approvals granted under the previous
 * policy can no longer be consumed (APPROVAL_POLICY_CHANGED).
 */
import { NextResponse } from "next/server"
import { z } from "zod"
import { requireHumanApprover } from "@/lib/agent-gateway/approvals/human-session"
import { approvalErrorResponse } from "@/lib/agent-gateway/approvals/http"
import { AUTONOMY_LEVELS } from "@/lib/agent-gateway/autonomy/types"
import { disableAutonomyPolicy, loadEffectiveAutonomyPolicy, setAutonomyPolicy } from "@/lib/agent-gateway/autonomy/policy-store"

const policySchema = z
  .object({
    autonomyLevel: z.enum(AUTONOMY_LEVELS),
    maxRiskTier: z.enum(["READ", "LOW_RISK_WRITE", "HIGH_RISK_MUTATION", "CRITICAL"]),
    allowedCapabilityIds: z.array(z.string().min(1).max(200)).max(500).optional(),
    approvalRequiredFor: z.array(z.string().min(1).max(200)).max(500).optional(),
    environmentScope: z.array(z.enum(["development", "staging", "production"])).max(3).optional(),
    resourceScopeReference: z.string().max(200).nullable().optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    note: z.string().max(500).optional(),
  })
  .strict()

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireHumanApprover(req)
    const { id } = await params
    const policy = await loadEffectiveAutonomyPolicy(id)
    return NextResponse.json({ success: true, policy, effectiveDefault: policy ? null : "OBSERVE_ONLY" })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireHumanApprover(req)
    const { id } = await params
    const parsed = policySchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Invalid autonomy policy payload" }, { status: 400 })
    }
    const result = await setAutonomyPolicy({
      ...parsed.data,
      connectionId: id,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      actorId: admin.userId,
    }).catch((err: unknown) => {
      if (err instanceof Error && err.message === "Connection not found.") return null
      throw err
    })
    if (!result) return NextResponse.json({ success: false, error: "Connection not found" }, { status: 404 })
    return NextResponse.json({ success: true, policy: result })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireHumanApprover(req)
    const { id } = await params
    await disableAutonomyPolicy(id)
    return NextResponse.json({ success: true, effectiveDefault: "OBSERVE_ONLY" })
  } catch (err) {
    return approvalErrorResponse(err)
  }
}
