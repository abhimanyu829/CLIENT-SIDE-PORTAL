/**
 * lib/agent-gateway/tests/recovery-test-kit.ts
 *
 * Shared harness for the Phase 11 suite (p11-*.test.ts): the Phase 7 fake
 * DB (which since Phase 11 also models AgentAuditEvent and AgentRecovery
 * with the migration's unique constraints), fixture capabilities that
 * declare EXPLICIT recovery mappings (Phase 11 ships no real write with a
 * recovery mapping yet; Phase 13's tickets.create is the first), and the
 * REAL ExecutionGate, AdapterResolver, audit ledger and RecoveryService.
 *
 * The fixtures operate on an in-memory "thing" store so a recovery can be
 * proven to actually restore / compensate state, not just to report it.
 */
import { vi } from "vitest"
import { z } from "zod"
import { createApprovalFakeDb } from "./approval-fake-db"
import { ALLOW, policy } from "./p7-helpers"
import type { AuthorizationDecision } from "../authorization/types"
import type { EffectiveAutonomyPolicy } from "../autonomy/types"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentCapabilityAdapter } from "../execution/contracts/adapter"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { AuditEventRow } from "../audit-ledger/types"

export const RT0 = new Date("2026-10-04T09:00:00.000Z")
export const SUPER_ADMIN_ID = "admin_1"

function writeFixture(id: string, overrides: Partial<CapabilityDefinition>): CapabilityDefinition {
  return {
    id,
    version: 1,
    domain: "fixtures",
    name: id,
    description: "Phase 11 recovery fixture.",
    status: "ACTIVE",
    operationType: "LOW_RISK_WRITE",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({ thingId: z.string().max(40) }).strict(),
    outputSchema: z.object({ ok: z.boolean() }).strict(),
    errorContract: [],
    requiredIdentityContext: ["connectionId", "ownerId"],
    resource: { resourceType: "Thing", resourceLocator: "thingId" },
    permission: { permission: null, note: "fixture" },
    sideEffects: { effects: ["fixture write"] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "fixture", class: "NON_IDEMPOTENT" },
    async: { executionMode: "SYNC" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "fixture" },
    executionReference: { adapterKey: `${id}Adapter` },
    ...overrides,
  }
}

/** COMPENSATABLE: creating a thing is offset by archiving it (the record remains). */
export const CREATE_THING = writeFixture("fixtures.createThing", {
  inputSchema: z.object({ name: z.string().min(1).max(40) }).strict(),
  outputSchema: z.object({ id: z.string(), name: z.string() }).strict(),
  resource: { resourceType: "Thing" },
  rollback: {
    reversibility: "REVERSIBLE",
    mechanism: "Archive the created thing.",
    recovery: {
      class: "COMPENSATABLE",
      capabilityId: "fixtures.archiveThing",
      capabilityVersion: 1,
      inputMapping: { thingId: "output.id" },
      residualEffects: "The archived thing remains visible in history.",
      manualRecoveryRequired: false,
      recommendation: "Archive the thing the agent created.",
    },
  },
})

/** The compensation. Keyed, so the recovery's deterministic idempotency key is exercised. */
export const ARCHIVE_THING = writeFixture("fixtures.archiveThing", {
  outputSchema: z.object({ id: z.string(), archived: z.boolean() }).strict(),
  idempotency: { requiresIdempotencyKey: true, retrySafe: false, duplicateBehavior: "fixture", class: "NON_IDEMPOTENT" },
  rollback: { reversibility: "REVERSIBLE", mechanism: "An administrator can unarchive the thing." },
})

/** REVERSIBLE: a price change is reversed by restoring the recorded previous price. */
export const SET_PRICE = writeFixture("fixtures.setPrice", {
  inputSchema: z.object({ thingId: z.string().max(40), price: z.number().int().min(0) }).strict(),
  outputSchema: z.object({ thingId: z.string(), price: z.number().int(), previousPrice: z.number().int().nullable() }).strict(),
  rollback: {
    reversibility: "REVERSIBLE",
    mechanism: "Set the previous price again.",
    recovery: {
      class: "REVERSIBLE",
      capabilityId: "fixtures.restorePrice",
      capabilityVersion: 1,
      inputMapping: { thingId: "input.thingId", price: "output.previousPrice" },
      manualRecoveryRequired: false,
      recommendation: "Restore the previous price.",
    },
  },
})

export const RESTORE_PRICE = writeFixture("fixtures.restorePrice", {
  inputSchema: z.object({ thingId: z.string().max(40), price: z.number().int().min(0) }).strict(),
  outputSchema: z.object({ thingId: z.string(), price: z.number().int() }).strict(),
})

/** IRREVERSIBLE with an explicit manual recommendation. */
export const SEND_NOTICE = writeFixture("fixtures.sendNotice", {
  rollback: {
    reversibility: "IRREVERSIBLE",
    mechanism: "A sent notice cannot be recalled.",
    recovery: { class: "IRREVERSIBLE", manualRecoveryRequired: true, recommendation: "Contact the recipient and send a correction." },
  },
})

/** A write with no recovery mapping at all: treated as manual recovery. */
export const NO_SPEC_WRITE = writeFixture("fixtures.noSpecWrite", {})

/** A read (nothing to recover). */
export const READ_THING = writeFixture("fixtures.readThing", {
  operationType: "READ",
  outputSchema: z.object({ id: z.string(), name: z.string(), archived: z.boolean(), price: z.number().int().nullable() }).strict(),
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "fixture", class: "IDEMPOTENT" },
})

export const RECOVERY_FIXTURES = [CREATE_THING, ARCHIVE_THING, SET_PRICE, RESTORE_PRICE, SEND_NOTICE, NO_SPEC_WRITE, READ_THING]

export interface Thing {
  id: string
  name: string
  archived: boolean
  price: number | null
}

export interface RecoveryKitState {
  authz: AuthorizationDecision
  policy: EffectiveAutonomyPolicy | null
  now: Date
  /** When set, the named adapter throws this ExecutionError code instead of running. */
  failAdapter: Record<string, string | undefined>
  /** When set, the named adapter throws exactly this error (after counting the dispatch). */
  adapterError: Record<string, Error | undefined>
}

export async function buildRecoveryKit() {
  vi.resetModules()
  const fake = createApprovalFakeDb()
  fake.seedConnection({ id: "conn_1", name: "Claude", ownerId: "owner_1" })
  fake.updateConnection("conn_1", { externalAgentId: "agent_1" })
  fake.seedConnection({ id: "conn_2", name: "Other agent", ownerId: "owner_2" })
  fake.seedUser({ id: SUPER_ADMIN_ID, phone: "+919999999999", phoneVerified: true, role: "SUPER_ADMIN" })
  vi.doMock("@/lib/db", () => ({ db: fake.client }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))

  const { CapabilityRegistry } = await import("../capabilities/registry")
  const { registerCoreCapabilities } = await import("../capabilities/manifest")
  const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
  const { registerCoreAdapters } = await import("../execution/adapters/index")
  const { AdapterResolver } = await import("../execution/resolver/adapter-resolver")
  const { ExecutionError } = await import("../execution/contracts/execution-error")
  const { buildExecutionContext } = await import("../execution/resolver/build-execution-context")
  const { ExecutionGate } = await import("../execution-gate/gate")
  const { AuthorizationDeniedError } = await import("../mcp/errors")
  const { RecoveryService } = await import("../recovery/service")
  const { GovernanceError } = await import("../governance/errors")
  const ledger = await import("../audit-ledger")
  const decisions = await import("../approvals/decision-service")
  const breakers = await import("../resilience/circuit-breaker")
  const metrics = await import("../observability/agent-metrics")
  const tracing = await import("../observability/tracing")
  const traceContext = await import("../observability/trace-context")

  const state: RecoveryKitState = {
    authz: ALLOW,
    policy: policy({ autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE" }),
    now: RT0,
    failAdapter: {},
    adapterError: {},
  }
  const clock = () => state.now
  const decide = vi.fn(async () => state.authz)
  const gate = new ExecutionGate({ authorization: { decide }, loadAutonomyPolicy: async () => state.policy, clock })

  const registry = new CapabilityRegistry()
  registerCoreCapabilities(registry)
  for (const f of RECOVERY_FIXTURES) registry.register(f)
  metrics.setKnownCapabilityIds(registry.list({ includeDisabled: true, includeForbidden: true }).map((d) => d.id))

  const things = new Map<string, Thing>()
  const dispatches: Array<{ capabilityId: string; input: Record<string, unknown>; idempotencyKey?: string }> = []
  let thingCounter = 0

  const run: Record<string, (input: Record<string, unknown>) => unknown> = {
    "fixtures.createThing": (input) => {
      thingCounter += 1
      const thing: Thing = { id: `thing_${thingCounter}`, name: String(input.name), archived: false, price: null }
      things.set(thing.id, thing)
      return { id: thing.id, name: thing.name }
    },
    "fixtures.archiveThing": (input) => {
      const thing = things.get(String(input.thingId))
      if (!thing) throw new ExecutionError("RESOURCE_NOT_FOUND", "No such thing.")
      thing.archived = true
      return { id: thing.id, archived: true }
    },
    "fixtures.setPrice": (input) => {
      const thing = things.get(String(input.thingId))
      if (!thing) throw new ExecutionError("RESOURCE_NOT_FOUND", "No such thing.")
      const previousPrice = thing.price
      thing.price = Number(input.price)
      return { thingId: thing.id, price: thing.price, previousPrice }
    },
    "fixtures.restorePrice": (input) => {
      const thing = things.get(String(input.thingId))
      if (!thing) throw new ExecutionError("RESOURCE_NOT_FOUND", "No such thing.")
      thing.price = Number(input.price)
      return { thingId: thing.id, price: thing.price }
    },
    "fixtures.sendNotice": () => ({ ok: true }),
    "fixtures.noSpecWrite": () => ({ ok: true }),
    "fixtures.readThing": (input) => {
      const thing = things.get(String(input.thingId))
      if (!thing) throw new ExecutionError("RESOURCE_NOT_FOUND", "No such thing.")
      return { ...thing }
    },
  }

  const adapters = new AdapterRegistry()
  registerCoreAdapters(adapters)
  for (const f of RECOVERY_FIXTURES) {
    const adapter: AgentCapabilityAdapter = {
      capabilityId: f.id,
      capabilityVersion: 1,
      async execute(context, input) {
        dispatches.push({ capabilityId: f.id, input: input as Record<string, unknown>, idempotencyKey: context.idempotencyKey })
        const failure = state.failAdapter[f.id]
        if (failure) throw new ExecutionError(failure as never, "Scripted fixture failure.")
        const scripted = state.adapterError[f.id]
        if (scripted) throw scripted
        return { output: run[f.id](input as Record<string, unknown>), executionMode: "SYNC", durationMs: 0 }
      },
    }
    adapters.register(adapter)
  }

  const resolver = new AdapterResolver(registry, adapters)
  const service = new RecoveryService({ capabilityRegistry: registry, adapterRegistry: adapters, gate, environment: "development", clock })

  function gatewayCtx(overrides: { connectionId?: string; ownerId?: string; agentId?: string; requestId?: string } = {}): AgentGatewayRequestContext {
    return {
      requestId: overrides.requestId ?? `req_${Math.random().toString(16).slice(2, 18).padEnd(16, "0")}`,
      receivedAt: state.now,
      authenticated: true,
      machine: {
        connectionId: overrides.connectionId ?? "conn_1",
        credentialId: "cred_1",
        ownerId: overrides.ownerId ?? "owner_1",
        agentId: overrides.agentId ?? "agent_1",
        connectionStatus: "ACTIVE",
        authenticatedAt: state.now,
      },
      protocol: "MCP",
      signal: new AbortController().signal,
    }
  }

  async function approveRef(ref: string, approverId = SUPER_ADMIN_ID): Promise<void> {
    const row = Array.from(fake._requests.values()).find((r) => r.publicRef === ref)
    if (!row) throw new Error(`no approval request ${ref}`)
    const approver = { userId: approverId, role: "SUPER_ADMIN", sessionReference: "sess_1" }
    await decisions.startApprovalStepUp(ref, approver, state.now, async () => true)
    await decisions.decideApproval({ publicRef: ref, decision: "APPROVE", approver, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" }, state.now)
  }

  /**
   * One agent operation exactly as the MCP tool callback runs it: the gate
   * decides (optionally obtaining a human approval first), then the Phase 4
   * resolver executes.
   */
  async function agentExecute(capabilityId: string, input: Record<string, unknown>, options: { idempotencyKey?: string; ctx?: AgentGatewayRequestContext; approve?: boolean } = {}) {
    const ctx = options.ctx ?? gatewayCtx()
    const def = registry.resolve(capabilityId)
    const execCtx = buildExecutionContext(ctx, def.id, def.version, "development", options.idempotencyKey)
    try {
      await gate.grant(execCtx, def, input)
    } catch (err) {
      if (!options.approve || !(err instanceof AuthorizationDeniedError) || err.code !== "APPROVAL_REQUIRED") throw err
      const ref = /apr_[0-9a-f]{32}/.exec(err.message)?.[0]
      if (!ref) throw err
      await approveRef(ref)
      await gate.grant(execCtx, def, input)
    }
    return resolver.execute(`${def.id}@v${def.version}`, input, ctx, options.idempotencyKey)
  }

  const flush = () => ledger.flushAuditLedger()
  const events = () => (Array.from(fake._auditEvents.values()) as unknown as AuditEventRow[]).sort((a, b) => a.sequence - b.sequence)
  const eventsFor = (action: string) => events().filter((e) => e.action === action)
  /** The latest recorded successful execution of `capabilityId` (after flushing best-effort appends). */
  async function lastSucceeded(capabilityId: string): Promise<AuditEventRow> {
    await flush()
    const found = eventsFor("execution.succeeded").filter((e) => e.capabilityId === capabilityId)
    if (found.length === 0) throw new Error(`no execution.succeeded for ${capabilityId}`)
    return found[found.length - 1]
  }
  const recoveries = () => Array.from(fake._recoveries.values()) as Array<Record<string, any>>
  const dispatchesOf = (capabilityId: string) => dispatches.filter((d) => d.capabilityId === capabilityId)

  async function catchCode(p: Promise<unknown>): Promise<string> {
    try {
      await p
      return "OK"
    } catch (err) {
      const code = (err as { code?: unknown }).code
      if (typeof code === "string") return code
      throw err
    }
  }

  return {
    fake,
    state,
    decide,
    gate,
    registry,
    adapters,
    resolver,
    service,
    things,
    dispatches,
    dispatchesOf,
    ledger,
    breakers,
    metrics,
    tracing,
    traceContext,
    decisions,
    ExecutionError,
    AuthorizationDeniedError,
    GovernanceError,
    RecoveryService,
    gatewayCtx,
    agentExecute,
    approveRef,
    flush,
    events,
    eventsFor,
    lastSucceeded,
    recoveries,
    catchCode,
  }
}

export type RecoveryKit = Awaited<ReturnType<typeof buildRecoveryKit>>
