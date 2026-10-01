/**
 * lib/agent-gateway/triggers/webhook-handler.ts
 *
 * POST /api/agent-webhooks/{triggerRef}. Accepts ONLY Abhibhi-format signed
 * deliveries (secrets.ts) for an ACTIVE webhook trigger. Check order — every
 * step fails closed, and nothing is parsed or looked up before it is needed:
 *
 *   feature enabled          404
 *   trigger ref format       404
 *   content type             415
 *   body size (streamed)     413
 *   signature headers + skew 401
 *   rate limit (per ref)     429 / 503 when the limiter is unavailable
 *   trigger WEBHOOK+ACTIVE   404 (never reveals whether it exists)
 *   secret decrypt           503
 *   HMAC signature           401
 *   nonce single use         409 replay / 503 when Redis is unavailable
 *   JSON object body         400
 *   bound resource id        400
 *   fire -> 202 accepted | 200 duplicate event id | 503 retryable
 *
 * The body can never choose the capability, input, owner, connection or
 * adapter: only `resourceId` is read (and only when the trigger binds it).
 * The body itself is never stored — only its SHA-256.
 */
import { NextResponse } from "next/server"
import type { RateLimitResult } from "../shared/types"
import { sha256Hex } from "../shared/crypto"
import { getGatewayConfig } from "../config"
import { checkAndConsumeNonce, type NonceCheckResult } from "../auth/replay-protection"
import { GatewayRedisRateLimiter } from "../limits/rate-limiter"
import { gatewayLogger } from "../observability/request-log"
import { getTriggerConfig } from "./config"
import { RESOURCE_ID_PATTERN } from "./event-catalog"
import { openWebhookSecret, parseWebhookTimestamp, verifyWebhookSignature, WEBHOOK_HEADERS } from "./secrets"
import { findTriggerByRef, TRIGGER_REF_PATTERN } from "./store"
import type { FireResult } from "./runtime"
import type { AgentTriggerRow, TriggerDelivery } from "./types"

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,128}$/
const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i

export interface WebhookRuntime {
  fire(trigger: Pick<AgentTriggerRow, "id">, delivery: TriggerDelivery): Promise<FireResult>
}

export interface WebhookHandlerDeps {
  enabled?: () => boolean
  maxBodyBytes?: number
  maxSkewSeconds?: number
  clock?: () => Date
  rateLimiter?: { check(key: string): Promise<RateLimitResult> }
  consumeNonce?: (keyId: string, nonce: string) => Promise<NonceCheckResult>
  loadTrigger?: (ref: string) => Promise<AgentTriggerRow | null>
  openSecret?: (sealed: string) => string
  /** Lazily created by the route (so a disabled feature never builds the task stack). */
  runtime: () => WebhookRuntime
}

type Code =
  | "NOT_FOUND"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "SIGNATURE_INVALID"
  | "RATE_LIMITED"
  | "REPLAY_DETECTED"
  | "INVALID_REQUEST"
  | "UNAVAILABLE"

function reject(status: number, error: Code, headers?: Record<string, string>): NextResponse {
  return NextResponse.json({ accepted: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

/** Reads at most `limit` bytes; null when the body is larger. */
async function readBounded(request: Request, limit: number): Promise<string | null> {
  if (!request.body) return ""
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > limit) {
      await reader.cancel().catch(() => undefined)
      return null
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8")
}

export async function handleAgentWebhook(request: Request, triggerRef: string, deps: WebhookHandlerDeps): Promise<NextResponse> {
  const config = getTriggerConfig()
  if (!(deps.enabled ?? (() => config.enabled))()) return reject(404, "NOT_FOUND")
  if (typeof triggerRef !== "string" || !TRIGGER_REF_PATTERN.test(triggerRef)) return reject(404, "NOT_FOUND")

  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase()
  if (contentType !== "application/json") return reject(415, "UNSUPPORTED_MEDIA_TYPE")

  const maxBody = deps.maxBodyBytes ?? config.webhookMaxBodyBytes
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (Number.isFinite(declared) && declared > maxBody) return reject(413, "PAYLOAD_TOO_LARGE")
  let body: string | null
  try {
    body = await readBounded(request, maxBody)
  } catch {
    return reject(400, "INVALID_REQUEST")
  }
  if (body === null) return reject(413, "PAYLOAD_TOO_LARGE")

  const timestamp = request.headers.get(WEBHOOK_HEADERS.timestamp) ?? ""
  const nonce = request.headers.get(WEBHOOK_HEADERS.nonce) ?? ""
  const eventId = request.headers.get(WEBHOOK_HEADERS.eventId) ?? ""
  const signature = request.headers.get(WEBHOOK_HEADERS.signature) ?? ""
  if (!NONCE_PATTERN.test(nonce) || !EVENT_ID_PATTERN.test(eventId) || !SIGNATURE_PATTERN.test(signature)) return reject(401, "SIGNATURE_INVALID")
  const sentAt = parseWebhookTimestamp(timestamp)
  const nowSeconds = Math.floor((deps.clock ?? (() => new Date()))().getTime() / 1000)
  const skew = deps.maxSkewSeconds ?? getGatewayConfig().AGENT_GATEWAY_MAX_CLOCK_SKEW_SECONDS
  if (sentAt === null || Math.abs(nowSeconds - sentAt) > skew) return reject(401, "SIGNATURE_INVALID")

  // Rate limit before any database work. Fails closed.
  try {
    const limit = await (deps.rateLimiter ?? new GatewayRedisRateLimiter()).check(`agent-webhook:${triggerRef}`)
    if (!limit.allowed) {
      if (limit.limit === 0) return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
      return reject(429, "RATE_LIMITED", { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 1000))) })
    }
  } catch {
    return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
  }

  let trigger: AgentTriggerRow | null
  try {
    trigger = await (deps.loadTrigger ?? findTriggerByRef)(triggerRef)
  } catch {
    return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
  }
  if (!trigger || trigger.type !== "WEBHOOK" || trigger.status !== "ACTIVE" || !trigger.webhookSecretRef) return reject(404, "NOT_FOUND")

  let secret: string
  try {
    secret = (deps.openSecret ?? openWebhookSecret)(trigger.webhookSecretRef)
  } catch {
    gatewayLogger.error({ triggerRef, reason: "SECRET_UNAVAILABLE" }, "agent_gateway_webhook_rejected")
    return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
  }
  const path = `/api/agent-webhooks/${trigger.publicRef}`
  if (!verifyWebhookSignature(secret, { timestamp, nonce, eventId, method: request.method, path, body }, signature)) {
    gatewayLogger.warn({ triggerRef, reason: "SIGNATURE_INVALID" }, "agent_gateway_webhook_rejected")
    return reject(401, "SIGNATURE_INVALID")
  }

  // Single use, AFTER the signature (an attacker can't burn a sender's nonces).
  const nonceResult = await (deps.consumeNonce ?? checkAndConsumeNonce)(`webhook:${trigger.publicRef}`, nonce).catch(
    (): NonceCheckResult => ({ ok: false, reason: "REDIS_UNAVAILABLE" })
  )
  if (!nonceResult.ok) {
    if (nonceResult.reason === "REPLAY_DETECTED") {
      gatewayLogger.warn({ triggerRef, reason: "REPLAY_DETECTED" }, "agent_gateway_webhook_rejected")
      return reject(409, "REPLAY_DETECTED")
    }
    return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return reject(400, "INVALID_REQUEST")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reject(400, "INVALID_REQUEST")

  let resourceId: string | null = null
  if (trigger.bindResource) {
    const candidate = (parsed as Record<string, unknown>).resourceId
    if (typeof candidate !== "string" || !RESOURCE_ID_PATTERN.test(candidate)) return reject(400, "INVALID_REQUEST")
    resourceId = candidate
  }

  let result: FireResult
  try {
    result = await deps.runtime().fire(trigger, { source: "WEBHOOK", deliveryKey: `webhook:${eventId}`, resourceId, bodyDigest: sha256Hex(body) })
  } catch {
    return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
  }

  switch (result.outcome) {
    case "INACTIVE":
      return reject(404, "NOT_FOUND")
    case "DUPLICATE":
      return NextResponse.json({ accepted: true, duplicate: true, runRef: result.runRef ?? null }, { status: 200, headers: { "Cache-Control": "no-store" } })
    default:
      if (result.retryable) return reject(503, "UNAVAILABLE", { "Retry-After": "30" })
      // Accepted for processing. The outcome (task, denial, approval) is for the admin, not the sender.
      return NextResponse.json({ accepted: true, duplicate: false, runRef: result.runRef ?? null }, { status: 202, headers: { "Cache-Control": "no-store" } })
  }
}
