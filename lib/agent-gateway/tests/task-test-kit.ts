/**
 * lib/agent-gateway/tests/task-test-kit.ts
 *
 * Shared harness for the Phase 8 test suite (p8-*.test.ts): the Phase 7 fake
 * DB (which also models AgentTask), an in-memory TaskQueuePort that records
 * every job, fixture capabilities for the write-path retry/approval rules
 * (Phase 8 ships async support only for READ capabilities), and a builder
 * that wires the REAL engine, worker and ExecutionGate with a scripted
 * Phase 6 decision and injectable autonomy policy.
 */
import { vi } from "vitest"
import { z } from "zod"
import { createApprovalFakeDb } from "./approval-fake-db"
import type { createExecutionFakeDb as CreateExecutionFakeDb } from "./execution-fake-db"
import { ALLOW, policy } from "./p7-helpers"
import type { AuthorizationDecision } from "../authorization/types"
import type { EffectiveAutonomyPolicy } from "../autonomy/types"
import type { CapabilityDefinition } from "../capabilities/types"
import type { AgentCapabilityAdapter } from "../execution/contracts/adapter"
import type { AgentGatewayRequestContext } from "../shared/types"
import type { TaskJobPayload, TaskQueuePort } from "../tasks/queue"
import type { TaskEngineConfig } from "../tasks/config"

export const T0 = new Date("2026-10-02T10:00:00.000Z")

export class InMemoryTaskQueue implements TaskQueuePort {
  configured = true
  failEnqueue = false
  readonly jobs = new Map<string, { payload: TaskJobPayload; delayMs?: number }>()
  readonly enqueued: Array<{ jobId: string; payload: TaskJobPayload; delayMs?: number }> = []
  readonly removed: string[] = []
  private readonly QueueUnavailable: new () => Error

  constructor(QueueUnavailable: new () => Error) {
    this.QueueUnavailable = QueueUnavailable
  }
  isConfigured(): boolean {
    return this.configured
  }
  async enqueue(payload: TaskJobPayload, options: { jobId: string; delayMs?: number }): Promise<void> {
    if (!this.configured || this.failEnqueue) throw new this.QueueUnavailable()
    // Deterministic job ids: the same attempt enqueued twice is one job (BullMQ semantics).
    if (!this.jobs.has(options.jobId)) this.jobs.set(options.jobId, { payload, delayMs: options.delayMs })
    this.enqueued.push({ jobId: options.jobId, payload, delayMs: options.delayMs })
  }
  async removePending(jobId: string): Promise<void> {
    this.removed.push(jobId)
    this.jobs.delete(jobId)
  }
  async hasJob(jobId: string): Promise<boolean> {
    if (!this.configured) throw new this.QueueUnavailable()
    return this.jobs.has(jobId)
  }
  /** Removes and returns the oldest job. */
  take(): { jobId: string; payload: TaskJobPayload; delayMs?: number } | null {
    const first = this.jobs.entries().next()
    if (first.done) return null
    const [jobId, job] = first.value
    this.jobs.delete(jobId)
    return { jobId, ...job }
  }
}

// ── Fixture capabilities (write-path rules are proven with fixtures only) ──

const fixtureOutput = z.object({ ok: z.boolean(), value: z.string().optional() }).strict()

function fixture(id: string, overrides: Partial<CapabilityDefinition>): CapabilityDefinition {
  return {
    id,
    version: 1,
    domain: "fixtures",
    name: id,
    description: "Phase 8 test fixture.",
    status: "ACTIVE",
    operationType: "LOW_RISK_WRITE",
    exposure: "AGENT_AVAILABLE",
    inputSchema: z.object({ value: z.string().max(200).optional(), big: z.number().int().optional() }).strict(),
    outputSchema: fixtureOutput,
    errorContract: [],
    requiredIdentityContext: ["connectionId", "ownerId"],
    resource: { resourceType: "Fixture", resourceLocator: "value" },
    permission: { permission: null, note: "fixture" },
    sideEffects: { effects: ["fixture write"] },
    idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "fixture", class: "NON_IDEMPOTENT" },
    async: { executionMode: "SYNC", asyncSupported: true, queue: "agent-task", worker: "agent-task" },
    rollback: { reversibility: "REVERSIBLE", mechanism: "fixture" },
    executionReference: { adapterKey: `${id}Adapter` },
    ...overrides,
  }
}

/** CONDITIONAL_RETRY: non-idempotent, retrySafe. */
export const FIXTURE_CONDITIONAL = fixture("fixtures.conditionalWrite", {})
/** NO_RETRY: irreversible. */
export const FIXTURE_NO_RETRY = fixture("fixtures.irreversibleWrite", { rollback: { reversibility: "IRREVERSIBLE", mechanism: "none" } })
/** SAFE_RETRY read whose adapter supports cooperative cancellation. */
export const FIXTURE_COOPERATIVE = fixture("fixtures.cooperativeRead", {
  operationType: "READ",
  idempotency: { requiresIdempotencyKey: false, retrySafe: true, duplicateBehavior: "fixture", class: "IDEMPOTENT" },
  async: { executionMode: "SYNC", asyncSupported: true, queue: "agent-task", worker: "agent-task", cooperativeCancellation: true },
})
/** Requires an idempotency key (CONDITIONAL_RETRY). */
export const FIXTURE_KEYED = fixture("fixtures.keyedWrite", {
  idempotency: { requiresIdempotencyKey: true, retrySafe: false, duplicateBehavior: "fixture", class: "NON_IDEMPOTENT" },
})

export type FixtureBehaviour = (input: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>

/** Fixture adapter whose behaviour each test scripts. Counts real dispatches. */
export function fixtureAdapter(capabilityId: string, calls: { count: number }, behaviour: { run: FixtureBehaviour }): AgentCapabilityAdapter {
  return {
    capabilityId,
    capabilityVersion: 1,
    async execute(context, input) {
      calls.count += 1
      const output = await behaviour.run(input as Record<string, unknown>, context.signal)
      return { output, executionMode: "SYNC", durationMs: 0 }
    },
  }
}

export interface KitState {
  authz: AuthorizationDecision
  authzThrows: boolean
  policy: EffectiveAutonomyPolicy | null
  policyThrows: boolean
  now: Date
}

export const TEST_CONFIG: TaskEngineConfig = {
  enabled: true,
  queueTimeoutMs: 15 * 60_000,
  executionTimeoutMs: 5_000,
  deadlineMs: 60 * 60_000,
  enqueueTimeoutMs: 1_000,
  startingGraceMs: 2 * 60_000,
  maxInputBytes: 4_096,
  maxResultBytes: 2_048,
  resultRetentionMs: 7 * 24 * 60 * 60_000,
  taskRetentionMs: 30 * 24 * 60 * 60_000,
  workerConcurrency: 1,
}

export function gatewayCtx(overrides: { connectionId?: string; ownerId?: string; status?: "ACTIVE" | "SUSPENDED"; requestId?: string } = {}): AgentGatewayRequestContext {
  return {
    requestId: overrides.requestId ?? "req_1",
    receivedAt: T0,
    authenticated: true,
    machine: {
      connectionId: overrides.connectionId ?? "conn_1",
      credentialId: "cred_1",
      ownerId: overrides.ownerId ?? "owner_1",
      agentId: "agent_1",
      connectionStatus: overrides.status ?? "ACTIVE",
      authenticatedAt: T0,
    },
    protocol: "MCP",
    signal: new AbortController().signal,
  }
}

export const SUPER_APPROVER = { userId: "admin_1", role: "SUPER_ADMIN", sessionReference: "sess_1" }

/**
 * Builds the real engine + worker over the fake DB. `executorOverride`
 * replaces the Phase 4 resolver (the MCP end-to-end suite uses the real one).
 */
export async function buildTaskKit(options: { config?: Partial<TaskEngineConfig>; withExecutionDb?: boolean } = {}) {
  vi.resetModules()
  const fake = createApprovalFakeDb()
  fake.seedConnection({ id: "conn_1", name: "Claude" })
  fake.seedUser({ id: "admin_1", phone: "+919999999999", phoneVerified: true })

  let execFake: ReturnType<typeof CreateExecutionFakeDb> | null = null
  let merged: Record<string, unknown> = fake.client
  if (options.withExecutionDb) {
    const { createExecutionFakeDb } = await import("./execution-fake-db")
    execFake = createExecutionFakeDb()
    merged = { ...execFake.client, ...fake.client }
    fake.setTransactionTarget(merged)
  }
  vi.doMock("@/lib/db", () => ({ db: merged }))
  vi.doMock("@/lib/redis", () => ({ redis: null }))
  vi.doMock("@/lib/otp", () => ({ generateOtp: () => "123456" }))
  vi.doMock("@/lib/twilio", () => ({ sendSms: vi.fn(async () => true) }))
  vi.doMock("../identity/connection-service", () => ({
    getAgentConnectionService: () => ({ getById: vi.fn(async (id: string) => ({ id, environment: "development" })) }),
  }))

  const { CapabilityRegistry } = await import("../capabilities/registry")
  const { registerCoreCapabilities } = await import("../capabilities/manifest")
  const { AdapterRegistry } = await import("../execution/resolver/adapter-registry")
  const { registerCoreAdapters } = await import("../execution/adapters/index")
  const { ExecutionGate } = await import("../execution-gate/gate")
  const { AgentTaskService } = await import("../tasks/engine")
  const { AgentTaskWorker } = await import("../tasks/worker")
  const { TaskQueueUnavailableError } = await import("../tasks/queue")
  const { TaskError } = await import("../tasks/errors")
  const { AuthorizationDeniedError } = await import("../mcp/errors")
  const decisions = await import("../approvals/decision-service")
  const store = await import("../tasks/store")
  const maintenance = await import("../tasks/maintenance")
  const { AGENT_TASK_JOBS } = await import("@/lib/queue")

  const state: KitState = {
    authz: ALLOW,
    authzThrows: false,
    policy: policy({ autonomyLevel: "LIMITED_AUTONOMY", maxRiskTier: "LOW_RISK_WRITE" }),
    policyThrows: false,
    now: T0,
  }
  const clock = () => state.now
  const decide = vi.fn(async () => {
    if (state.authzThrows) throw new Error("policy store down")
    return state.authz
  })
  const gate = new ExecutionGate({
    authorization: { decide },
    loadAutonomyPolicy: async () => {
      if (state.policyThrows) throw new Error("autonomy store down")
      return state.policy
    },
    clock,
  })

  const registry = new CapabilityRegistry()
  registerCoreCapabilities(registry)
  for (const f of [FIXTURE_CONDITIONAL, FIXTURE_NO_RETRY, FIXTURE_COOPERATIVE, FIXTURE_KEYED]) registry.register(f)
  const adapters = new AdapterRegistry()
  registerCoreAdapters(adapters)
  const calls = { count: 0 }
  const behaviour: { run: FixtureBehaviour } = { run: async (input) => ({ ok: true, value: String(input.value ?? "") }) }
  for (const f of [FIXTURE_CONDITIONAL, FIXTURE_NO_RETRY, FIXTURE_COOPERATIVE, FIXTURE_KEYED]) adapters.register(fixtureAdapter(f.id, calls, behaviour))

  const config: TaskEngineConfig = { ...TEST_CONFIG, ...options.config }
  const queue = new InMemoryTaskQueue(TaskQueueUnavailableError)
  const service = new AgentTaskService({ capabilityRegistry: registry, adapterRegistry: adapters, gate, queue, config, clock })
  const worker = new AgentTaskWorker({
    capabilityRegistry: registry,
    adapterRegistry: adapters,
    gate,
    queue,
    config,
    clock,
    environment: "development",
    cancellationPollMs: 5,
  })

  /** Runs every queued job (FIFO) through the worker, including retries it schedules. */
  async function drain(max = 25): Promise<number> {
    let processed = 0
    for (let i = 0; i < max; i += 1) {
      const job = queue.take()
      if (!job) break
      await worker.process({ name: AGENT_TASK_JOBS.EXECUTE, data: job.payload, id: job.jobId })
      processed += 1
    }
    return processed
  }

  async function submit(capabilityId: string, input: Record<string, unknown> = {}, idempotencyKey?: string, ctx = gatewayCtx()) {
    return service.submit(ctx, "development", { capabilityId, input, idempotencyKey })
  }

  async function catchCode(p: Promise<unknown>): Promise<string> {
    try {
      await p
      return "OK"
    } catch (err) {
      if (err instanceof TaskError || err instanceof AuthorizationDeniedError) return err.code
      throw err
    }
  }

  const taskByRef = (ref: string) => Array.from(fake._tasks.values()).find((r) => r.taskRef === ref) as Record<string, any> | undefined

  async function approveFromMessage(message: string) {
    const ref = /apr_[0-9a-f]{32}/.exec(message)?.[0]
    if (!ref) throw new Error(`no approval ref in: ${message}`)
    const row = Array.from(fake._requests.values()).find((r) => r.publicRef === ref)!
    await decisions.startApprovalStepUp(ref, SUPER_APPROVER, state.now, async () => true)
    await decisions.decideApproval(
      { publicRef: ref, decision: "APPROVE", approver: SUPER_APPROVER, confirmedBindingDigest: row.bindingDigest as string, stepUpCode: "123456" },
      state.now
    )
    return ref
  }

  return {
    fake,
    execFake,
    state,
    decide,
    gate,
    registry,
    adapters,
    queue,
    service,
    worker,
    calls,
    behaviour,
    config,
    store,
    maintenance,
    AGENT_TASK_JOBS,
    TaskError,
    AuthorizationDeniedError,
    drain,
    submit,
    catchCode,
    taskByRef,
    approveFromMessage,
    advance: (ms: number) => {
      state.now = new Date(state.now.getTime() + ms)
    },
  }
}
