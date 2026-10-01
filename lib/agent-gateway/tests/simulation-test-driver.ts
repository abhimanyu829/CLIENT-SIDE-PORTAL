/**
 * lib/agent-gateway/tests/simulation-test-driver.ts
 *
 * The Phase 14 SimulationDriver: executes scenario steps on the REAL
 * gateway (MCP server, input hygiene, Phase 6 policy engine, Phase 7 gate
 * and approvals, Phase 8 task engine and worker, Phase 4 resolver and
 * adapters, Phase 11 ledger, Phase 12 content guard) of the governance
 * test kit, in the deterministic SIM_WORLD. Only datastores are in-memory.
 */
import { buildGovernanceKit, SUPER, type GovernanceKit } from "./governance-test-kit"
import { errorCodeOf } from "../simulation/runner"
import { SIM_WORLD } from "../simulation/world"
import type { LedgerEventView, Observation, SimActor, SimStep, SimulationDriver, WorldSnapshot } from "../simulation/types"

const T0 = new Date("2026-09-01T10:00:00.000Z")

export interface SimulationHarness {
  k: GovernanceKit
  driver: SimulationDriver
  /** Raw calls made against the Phase 4 business fake (for "nothing ran" assertions). */
  adapterCalls: () => number
}

export async function buildSimulationHarness(): Promise<SimulationHarness> {
  const k = await buildGovernanceKit()
  const ledger = await import("../audit-ledger")

  for (const p of SIM_WORLD.products) k.exec.seedProduct({ ...p, averageRating: 4, reviewCount: 1 })
  for (const v of SIM_WORLD.vendors) k.exec.seedVendor({ ...v })
  for (const s of SIM_WORLD.subscriptions) k.exec.seedSubscription({ ...s, currentPeriodEnd: new Date(T0.getTime() + 30 * 86_400_000), cancelAtPeriodEnd: false, createdAt: T0 })
  for (const t of SIM_WORLD.tickets) k.exec.seedTicket({ ...t, assignedTo: "staff_9", priority: "MEDIUM", category: "GENERAL", createdAt: T0, updatedAt: T0 })
  for (const m of SIM_WORLD.ticketMessages) k.exec.seedTicketMessage({ ...m, createdAt: T0 })

  // Phase 6: every executable capability is allowed up to its own tier (the strongest realistic grant).
  for (const def of k.registry.list()) {
    if (def.exposure !== "AGENT_AVAILABLE" || !k.adapters.has(def.id, def.version)) continue
    await k.policyStore.createPolicyVersion({ name: `sim allow ${def.id}`, effect: "ALLOW", scope: "CAPABILITY", capabilityId: def.id, riskConstraint: def.operationType as "READ", actorId: SUPER })
  }
  for (const [connectionId, a] of Object.entries(SIM_WORLD.autonomy)) {
    await k.autonomyStore.setAutonomyPolicy({ connectionId, autonomyLevel: a.autonomyLevel, maxRiskTier: a.maxRiskTier, actorId: SUPER })
  }

  const initialTickets = new Map(Array.from(k.exec._tickets.values()).map((t) => [t.id, t.status]))
  const ctx = (a: SimActor) => k.agentCtx(a.connectionId, a.ownerId)

  function observe(index: number, step: SimStep, out: { result?: any; error?: any }): Observation {
    const result = out.result
    const first: string = result?.content?.[0]?.text ?? (out.error ? `MCP error ${out.error.code}: ${out.error.message}` : "")
    let output: unknown
    try {
      output = JSON.parse(first)
    } catch {
      output = undefined
    }
    const isError = result?.isError === true || !!out.error
    return {
      index,
      kind: step.kind,
      label: step.label,
      actor: "actor" in step ? step.actor : undefined,
      name: step.kind === "tool" ? step.name : step.kind === "task_submit" ? "agent_task_submit" : undefined,
      isError,
      code: isError ? errorCodeOf(first) ?? "UNKNOWN" : null,
      text: JSON.stringify(out),
      message: first,
      output,
    }
  }

  const driver: SimulationDriver = {
    async execute(step, index) {
      switch (step.kind) {
        case "tool": {
          const params: Record<string, unknown> = { name: step.name, arguments: step.args }
          if (step.meta) params._meta = step.meta
          return observe(index, step, await k.mcp("tools/call", params, ctx(step.actor)))
        }
        case "task_submit": {
          const args = { capabilityId: step.capabilityId, input: step.input, ...(step.idempotencyKey ? { idempotencyKey: step.idempotencyKey } : {}) }
          return observe(index, step, await k.mcp("tools/call", { name: "agent_task_submit", arguments: args }, ctx(step.actor)))
        }
        case "drain":
          await k.drain()
          return { index, kind: step.kind, label: step.label, isError: false, code: null, text: "" }
        case "approve_latest": {
          const pending = (Array.from(k.approval._requests.values()) as Array<Record<string, any>>)
            .filter((r) => r.connectionId === step.actor.connectionId && r.status === "PENDING")
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          if (pending[0]) await k.approve(pending[0].publicRef as string)
          return { index, kind: step.kind, label: step.label, isError: !pending[0], code: pending[0] ? null : "NO_PENDING_APPROVAL", text: "" }
        }
        case "list_tools": {
          const out = await k.mcp("tools/list", {}, ctx(step.actor))
          const tools = ((out.result?.tools ?? []) as Array<{ name: string }>).map((t) => t.name)
          return { index, kind: step.kind, label: step.label, actor: step.actor, isError: !!out.error, code: null, text: JSON.stringify(out), tools }
        }
      }
    },
    async snapshot(): Promise<WorldSnapshot> {
      await ledger.flushAuditLedger()
      const rows = (Array.from(k.approval._auditEvents.values()) as Array<Record<string, any>>).sort((a, b) => a.sequence - b.sequence)
      const view: LedgerEventView[] = rows.map((r) => ({
        sequence: r.sequence,
        action: r.action,
        outcome: r.outcome,
        requestId: r.requestId ?? null,
        connectionId: r.connectionId ?? null,
        ownerId: r.ownerId ?? null,
        capabilityId: r.capabilityId ?? null,
        riskTier: r.riskTier ?? null,
      }))
      const consumed = new Map<string, number>()
      for (const r of rows) if (r.action === "approval.consumed" && r.approvalRef) consumed.set(r.approvalRef, (consumed.get(r.approvalRef) ?? 0) + 1)
      const writes: WorldSnapshot["writes"] = []
      for (const t of k.exec._tickets.values()) {
        if (!initialTickets.has(t.id)) writes.push({ model: "Ticket", id: t.id, ownerId: t.clientId, change: "created" })
        else if (initialTickets.get(t.id) !== t.status) writes.push({ model: "Ticket", id: t.id, ownerId: t.clientId, change: "updated" })
      }
      return {
        ledger: view,
        ledgerChainValid: (await ledger.verifyAuditChain()).ok === true,
        writes,
        tenantMarkers: Object.fromEntries(Object.entries(SIM_WORLD.tenantMarkers).map(([o, m]) => [o, [...m]])),
        approvals: (Array.from(k.approval._requests.values()) as Array<Record<string, any>>).map((r) => ({ publicRef: r.publicRef, status: r.status, consumedCount: consumed.get(r.publicRef) ?? 0 })),
      }
    },
  }

  const businessMethods = () =>
    Object.values(k.exec.client).flatMap((model) => Object.values(model as Record<string, { mock?: { calls: unknown[] } }>)).reduce((n, fn) => n + (fn.mock?.calls.length ?? 0), 0)
  return { k, driver, adapterCalls: businessMethods }
}
