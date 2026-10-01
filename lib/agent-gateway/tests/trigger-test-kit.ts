/**
 * lib/agent-gateway/tests/trigger-test-kit.ts
 *
 * Shared harness for the Phase 9 suite (p9-*.test.ts). Builds on the Phase 8
 * kit (REAL task engine + worker + ExecutionGate over the fake DB, which also
 * models AgentTrigger / AgentTriggerRun) and adds the REAL TriggerService,
 * TriggerRuntime and webhook handler, with an in-memory nonce store and rate
 * limiter standing in for Redis (the production ones fail closed without it).
 */
import { buildTaskKit, T0 } from "./task-test-kit"
import type { TriggerConfig } from "../triggers/config"
import type { RateLimitResult } from "../shared/types"

export { T0 }

export const TRIGGER_TEST_CONFIG: TriggerConfig = {
  enabled: true,
  minIntervalMs: 5 * 60_000,
  lateToleranceMs: 2 * 60_000,
  catchUpWindowMs: 24 * 60 * 60_000,
  maxOnceHorizonMs: 365 * 24 * 60 * 60_000,
  webhookMaxBodyBytes: 4_096,
  tickBatch: 100,
}

export interface SignedRequestOptions {
  nonce?: string
  eventId?: string
  timestamp?: string
  method?: string
  contentType?: string | null
  signature?: string
  /** Sign this path instead of the real one (tamper tests). */
  signedPath?: string
  /** Sign this body instead of the sent one (tamper tests). */
  signedBody?: string
  /** Sign this method instead of the sent one (tamper tests). */
  signedMethod?: string
  omit?: Array<"timestamp" | "nonce" | "eventId" | "signature">
  extraHeaders?: Record<string, string>
}

let nonceCounter = 0

export async function buildTriggerKit(options: { withExecutionDb?: boolean; triggerConfig?: Partial<TriggerConfig> } = {}) {
  const kit = await buildTaskKit({ withExecutionDb: options.withExecutionDb })
  const { TriggerService } = await import("../triggers/service")
  const { TriggerRuntime } = await import("../triggers/runtime")
  const { handleAgentWebhook } = await import("../triggers/webhook-handler")
  const { TriggerError } = await import("../triggers/errors")
  const { notifyAgentEventTriggers } = await import("../triggers/event-intake")
  const { normalizeTriggerEvent } = await import("../triggers/event-catalog")
  const secrets = await import("../triggers/secrets")
  const triggerStore = await import("../triggers/store")

  const triggerConfig: TriggerConfig = { ...TRIGGER_TEST_CONFIG, ...options.triggerConfig }
  const clock = () => kit.state.now
  const triggers = new TriggerService({ capabilityRegistry: kit.registry, config: triggerConfig, clock, environment: "development" })
  const runtime = new TriggerRuntime({ taskService: kit.service, capabilityRegistry: kit.registry, config: triggerConfig, clock, environment: "development" })

  // Redis stand-ins with the production semantics (single-use nonces, fail closed).
  const nonceStore = { used: new Set<string>(), down: false }
  const limiter = { allowed: true, unavailable: false, calls: [] as string[] }
  const webhookDeps = {
    enabled: () => true,
    maxBodyBytes: triggerConfig.webhookMaxBodyBytes,
    maxSkewSeconds: 300,
    clock,
    rateLimiter: {
      check: async (key: string): Promise<RateLimitResult> => {
        limiter.calls.push(key)
        if (limiter.unavailable) return { allowed: false, limit: 0, remaining: 0, resetAt: clock() }
        return limiter.allowed
          ? { allowed: true, limit: 60, remaining: 59, resetAt: new Date(clock().getTime() + 60_000) }
          : { allowed: false, limit: 60, remaining: 0, resetAt: new Date(Date.now() + 30_000) }
      },
    },
    consumeNonce: async (keyId: string, nonce: string) => {
      if (nonceStore.down) return { ok: false as const, reason: "REDIS_UNAVAILABLE" as const }
      const key = `${keyId}:${nonce}`
      if (nonceStore.used.has(key)) return { ok: false as const, reason: "REPLAY_DETECTED" as const }
      nonceStore.used.add(key)
      return { ok: true as const }
    },
    runtime: () => runtime,
  }

  async function createActive(input: Record<string, unknown>, actor = "admin_1") {
    const { trigger, webhookSecret } = await triggers.create(input, actor)
    const active = await triggers.transition(trigger.triggerRef, trigger.version, "activate", actor)
    return { trigger: active, webhookSecret }
  }

  /** A correctly signed Abhibhi webhook delivery (each part overridable for tamper tests). */
  function signedRequest(ref: string, secret: string, body: string | Record<string, unknown>, o: SignedRequestOptions = {}): Request {
    const text = typeof body === "string" ? body : JSON.stringify(body)
    nonceCounter += 1
    const nonce = o.nonce ?? `nonce-${String(nonceCounter).padStart(4, "0")}-${Math.random().toString(36).slice(2, 12)}`
    const eventId = o.eventId ?? `evt_${nonceCounter}`
    const timestamp = o.timestamp ?? String(Math.floor(clock().getTime() / 1000))
    const method = o.method ?? "POST"
    const path = `/api/agent-webhooks/${ref}`
    const signature =
      o.signature ??
      secrets.signWebhook(secret, { timestamp, nonce, eventId, method: o.signedMethod ?? method, path: o.signedPath ?? path, body: o.signedBody ?? text })
    const headers: Record<string, string> = {
      ...(o.contentType === null ? {} : { "content-type": o.contentType ?? "application/json" }),
      [secrets.WEBHOOK_HEADERS.timestamp]: timestamp,
      [secrets.WEBHOOK_HEADERS.nonce]: nonce,
      [secrets.WEBHOOK_HEADERS.eventId]: eventId,
      [secrets.WEBHOOK_HEADERS.signature]: signature,
      ...o.extraHeaders,
    }
    for (const k of o.omit ?? []) delete headers[secrets.WEBHOOK_HEADERS[k]]
    return new Request(`https://abhibhi.test${path}`, { method, headers, body: text })
  }

  async function deliver(ref: string, req: Request) {
    const res = await handleAgentWebhook(req, ref, webhookDeps)
    const json = (await res.json()) as Record<string, unknown>
    return { status: res.status, json }
  }

  const triggerRow = (ref: string) => Array.from(kit.fake._triggers.values()).find((r) => r.publicRef === ref) as Record<string, any>
  const runsOf = (ref: string) => {
    const t = triggerRow(ref)
    return Array.from(kit.fake._triggerRuns.values()).filter((r) => r.triggerId === t?.id) as Record<string, any>[]
  }
  const tasksOf = (ref: string) => {
    const t = triggerRow(ref)
    return Array.from(kit.fake._tasks.values()).filter((r) => r.triggerId === t?.id) as Record<string, any>[]
  }

  async function catchTrigger(p: Promise<unknown>): Promise<string> {
    try {
      await p
      return "OK"
    } catch (err) {
      if (err instanceof TriggerError) return err.code
      throw err
    }
  }

  /** Finishes a trigger's tasks through the real worker. */
  const drainTasks = () => kit.drain()

  return {
    ...kit,
    triggerConfig,
    triggers,
    runtime,
    webhookDeps,
    nonceStore,
    limiter,
    handleAgentWebhook,
    notifyAgentEventTriggers,
    normalizeTriggerEvent,
    TriggerError,
    secrets,
    triggerStore,
    createActive,
    signedRequest,
    deliver,
    triggerRow,
    runsOf,
    tasksOf,
    catchTrigger,
    drainTasks,
  }
}

/** Minimal valid inputs for the three trigger types. */
export const EVENT_TRIGGER = {
  type: "EVENT",
  name: "Product watcher",
  connectionId: "conn_1",
  capabilityId: "products.get",
  bindResource: true,
  event: { eventType: "PRODUCT_UPDATED" },
}
export const WEBHOOK_TRIGGER = {
  type: "WEBHOOK",
  name: "Inbound hook",
  connectionId: "conn_1",
  capabilityId: "products.list",
  input: {},
}
export const SCHEDULE_TRIGGER = {
  type: "SCHEDULE",
  name: "Hourly catalog read",
  connectionId: "conn_1",
  capabilityId: "products.list",
  input: {},
  schedule: { kind: "CRON", cron: "0 * * * *", timezone: "UTC" },
}

export function productEvent(productId: string, actorId = "owner_1", timestamp = "2026-10-02T10:00:00.000Z", type = "PRODUCT_UPDATED") {
  return { type, timestamp, actorId, payload: { productId, productName: "Secret Product Name", price: 4200 } } as never
}
