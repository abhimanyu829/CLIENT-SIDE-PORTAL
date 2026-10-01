/**
 * lib/agent-gateway/triggers/event-catalog.ts
 *
 * The ALLOWLIST of existing platform events (lib/services/event-bus.ts) that
 * may drive an agent event trigger, and how each one identifies its resource
 * and (where relevant) the user it is about. An event not listed here can
 * never fire a trigger, whatever its name.
 *
 * Payment, refund, user, fraud and credential events are deliberately
 * excluded: money movement and identity changes are not agent automation
 * inputs.
 *
 * Only ids leave the event: the payload itself is never copied into a queue
 * job, a trigger run or a capability input.
 *
 * NOTE: string keys only (no runtime import of event-bus) — event-bus imports
 * the intake module, so importing its values here would be a cycle.
 */
import { createHash } from "crypto"
import type { PlatformEvent } from "@/lib/services/event-bus"
import { canonicalJson } from "../approvals/canonical-json"

export interface TriggerEventDefinition {
  resourceType: string
  resourceIdField: string
  /** Payload field naming the user the event is about. Such events only fire OWNER-scoped triggers. */
  subjectUserField?: string
}

export const TRIGGER_EVENT_CATALOG: Readonly<Record<string, TriggerEventDefinition>> = Object.freeze({
  PRODUCT_CREATED: { resourceType: "Product", resourceIdField: "productId" },
  PRODUCT_UPDATED: { resourceType: "Product", resourceIdField: "productId" },
  PRODUCT_SOLD_OUT: { resourceType: "Product", resourceIdField: "productId" },
  INVENTORY_UPDATED: { resourceType: "Product", resourceIdField: "productId" },
  SUBSCRIPTION_ACTIVATED: { resourceType: "Subscription", resourceIdField: "subscriptionId", subjectUserField: "userId" },
  SUBSCRIPTION_CANCELLED: { resourceType: "Subscription", resourceIdField: "subscriptionId", subjectUserField: "userId" },
})

/** Resource / user ids accepted from events and webhooks: short, plain identifiers only. */
export const RESOURCE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export interface NormalizedTriggerEvent {
  eventType: string
  /** Stable identity of this exact event (dedup key). */
  digest: string
  resourceType: string
  resourceId: string | null
  actorId: string | null
  subjectUserId: string | null
  occurredAt: string
}

const plainId = (v: unknown): string | null => (typeof v === "string" && RESOURCE_ID_PATTERN.test(v) ? v : null)

/**
 * Reduces a platform event to the ids a trigger may use, or null when the
 * event type is not allowlisted. The digest covers the whole event (type,
 * time, actor, payload): an exact re-delivery has the same identity, two
 * distinct events do not.
 */
export function normalizeTriggerEvent(event: PlatformEvent): NormalizedTriggerEvent | null {
  const definition = TRIGGER_EVENT_CATALOG[event.type]
  if (!definition) return null
  const payload = (event.payload ?? {}) as Record<string, unknown>
  let digest: string
  try {
    digest = createHash("sha256").update(`abhibhi.trigger-event.v1\n${canonicalJson({ type: event.type, timestamp: event.timestamp, actorId: event.actorId ?? null, payload })}`).digest("hex")
  } catch {
    return null
  }
  return {
    eventType: event.type,
    digest,
    resourceType: definition.resourceType,
    resourceId: plainId(payload[definition.resourceIdField]),
    actorId: plainId(event.actorId),
    subjectUserId: definition.subjectUserField ? plainId(payload[definition.subjectUserField]) : null,
    occurredAt: typeof event.timestamp === "string" ? event.timestamp : new Date().toISOString(),
  }
}
