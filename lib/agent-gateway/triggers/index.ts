/**
 * lib/agent-gateway/triggers/index.ts — Phase 9 event / webhook / schedule triggers.
 *
 * Factories wire the runtime to the EXISTING singletons: the Phase 3
 * capability registry and the Phase 8 task service (which itself wraps the
 * Phase 7 ExecutionGate over Phase 6, and the existing agent-task queue).
 */
import { getCapabilityRegistry } from "../capabilities"
import { ExecutionGate } from "../execution-gate/gate"
import { PolicyEngineAuthorizer } from "../authorization/authorizer"
import { createAgentTaskService } from "../tasks"
import { TriggerRuntime } from "./runtime"
import { TriggerService } from "./service"

/** The runtime used by the worker (events, schedule ticks) and the webhook route. */
export function createTriggerRuntime(): TriggerRuntime {
  const gate = new ExecutionGate({ authorization: new PolicyEngineAuthorizer() })
  return new TriggerRuntime({ taskService: createAgentTaskService(gate), capabilityRegistry: getCapabilityRegistry() })
}

/** Human-side management (Phase 10 governance routes only). */
export function createTriggerService(): TriggerService {
  return new TriggerService()
}

export { TriggerRuntime, TRIGGER_EVENT_JOB_SCHEMA } from "./runtime"
export type { FireResult, FireOutcome, TickReport, TriggerRuntimeDeps, TriggerTaskSubmitter, TriggerConnectionState } from "./runtime"
export { TriggerService, createTriggerSchema, updateTriggerSchema } from "./service"
export type { CreateTriggerInput, UpdateTriggerInput, TriggerServiceDeps } from "./service"
export { TriggerError } from "./errors"
export { getTriggerConfig, DEFAULT_TRIGGER_CONFIG, __resetTriggerConfigForTests } from "./config"
export type { TriggerConfig } from "./config"
export { notifyAgentEventTriggers } from "./event-intake"
export { handleAgentWebhook } from "./webhook-handler"
export { TRIGGER_EVENT_CATALOG, normalizeTriggerEvent } from "./event-catalog"
export { WEBHOOK_HEADERS, signWebhook, webhookCanonicalMessage } from "./secrets"
export { isLegalTriggerTransition, TRIGGER_ACTIONS } from "./state-machine"
export { toTriggerView, toTriggerRunView } from "./view"
export * from "./types"
