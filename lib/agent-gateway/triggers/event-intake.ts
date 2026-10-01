/**
 * lib/agent-gateway/triggers/event-intake.ts
 *
 * The ONE hook between the existing platform event bus
 * (lib/services/event-bus.ts emitEvent) and agent event triggers.
 *
 * It does as little as possible inside the emitting request:
 *   - no-op unless triggers are enabled and the event type is allowlisted;
 *   - reduces the event to ids (never the payload) and enqueues ONE
 *     reference job on the existing agent-task queue, with a deterministic
 *     job id (the event digest), so an exact re-emission is one job;
 *   - never throws and never blocks the caller beyond one bounded enqueue.
 * Matching triggers, authorization and task creation all happen later in
 * the worker (TriggerRuntime), not in the business request.
 */
import type { PlatformEvent } from "@/lib/services/event-bus"
import { agentTaskQueue, AGENT_TASK_JOBS } from "@/lib/queue"
import { env } from "@/lib/env"
import { gatewayLogger } from "../observability/request-log"
import { getTriggerConfig } from "./config"
import { normalizeTriggerEvent, type NormalizedTriggerEvent } from "./event-catalog"

const ENQUEUE_TIMEOUT_MS = 2_000

export interface EventIntakeDeps {
  enabled?: () => boolean
  /** Defaults to the existing agent-task BullMQ queue. Must resolve to a job ({ id }) on success. */
  enqueue?: (payload: NormalizedTriggerEvent, jobId: string) => Promise<unknown>
}

async function defaultEnqueue(payload: NormalizedTriggerEvent, jobId: string): Promise<unknown> {
  if (!env.REDIS_URL) return null
  return agentTaskQueue.add(AGENT_TASK_JOBS.TRIGGER_EVENT, payload, {
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  })
}

/** Called by emitEvent for every platform event. Never throws. */
export async function notifyAgentEventTriggers(event: PlatformEvent, deps: EventIntakeDeps = {}): Promise<void> {
  try {
    if (!(deps.enabled ?? (() => getTriggerConfig().enabled))()) return
    const normalized = normalizeTriggerEvent(event)
    if (!normalized) return
    const jobId = `evt-${normalized.digest}`
    let timer: ReturnType<typeof setTimeout> | undefined
    const job = await Promise.race([
      (deps.enqueue ?? defaultEnqueue)(normalized, jobId),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ENQUEUE_TIMEOUT_MS)
      }),
    ]).finally(() => {
      if (timer) clearTimeout(timer)
    })
    if (!job || typeof job !== "object" || !(job as { id?: unknown }).id) {
      // Fail visible, not silent: the lazy queue proxy no-ops without Redis.
      gatewayLogger.warn({ eventType: normalized.eventType, reason: "QUEUE_UNAVAILABLE" }, "agent_gateway_trigger_event_not_enqueued")
      return
    }
    gatewayLogger.debug({ eventType: normalized.eventType, jobId }, "agent_gateway_trigger_event_enqueued")
  } catch {
    gatewayLogger.warn({ eventType: event?.type ?? null, reason: "INTAKE_ERROR" }, "agent_gateway_trigger_event_not_enqueued")
  }
}
