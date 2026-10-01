/**
 * lib/agent-gateway/tasks/index.ts — Phase 8 Async Task Engine.
 *
 * Factories wire the engine to the EXISTING singletons: the Phase 3
 * capability registry, the Phase 4 adapter registry, the Phase 7
 * ExecutionGate (wrapping Phase 6), and lib/queue.ts's agent-task queue.
 */
import { getCapabilityRegistry } from "../capabilities"
import { getAdapterRegistry } from "../execution"
import { ExecutionGate } from "../execution-gate/gate"
import { PolicyEngineAuthorizer } from "../authorization/authorizer"
import { getTaskEngineConfig } from "./config"
import { getDefaultTaskQueue } from "./queue"
import { AgentTaskService, type TaskGate } from "./engine"
import { AgentTaskWorker } from "./worker"

/** The agent-facing task service, sharing the request's ExecutionGate. */
export function createAgentTaskService(gate: TaskGate): AgentTaskService {
  const config = getTaskEngineConfig()
  return new AgentTaskService({
    capabilityRegistry: getCapabilityRegistry(),
    adapterRegistry: getAdapterRegistry(),
    gate,
    queue: getDefaultTaskQueue(config.enqueueTimeoutMs),
    config,
  })
}

/** The `agent-task` queue processor used by lib/workers.ts. */
export function createAgentTaskWorker(): AgentTaskWorker {
  const config = getTaskEngineConfig()
  return new AgentTaskWorker({
    capabilityRegistry: getCapabilityRegistry(),
    adapterRegistry: getAdapterRegistry(),
    gate: new ExecutionGate({ authorization: new PolicyEngineAuthorizer() }),
    queue: getDefaultTaskQueue(config.enqueueTimeoutMs),
    config,
  })
}

export { AgentTaskService } from "./engine"
export type { TaskGate, AgentTaskServiceDeps, SubmitTaskArgs, TaskOrigin } from "./engine"
export { AgentTaskWorker } from "./worker"
export type { AgentTaskWorkerDeps, TaskExecutor, TaskJobLike } from "./worker"
export { runTaskMaintenance } from "./maintenance"
export type { MaintenanceReport } from "./maintenance"
export { BullTaskQueue, TaskQueueUnavailableError, TASK_JOB_PAYLOAD_SCHEMA, getDefaultTaskQueue } from "./queue"
export type { TaskQueuePort, TaskJobPayload, BullQueueLike } from "./queue"
export { getTaskEngineConfig, DEFAULT_TASK_ENGINE_CONFIG, __resetTaskEngineConfigForTests } from "./config"
export type { TaskEngineConfig } from "./config"
export { TaskError } from "./errors"
export { classifyRetry, maxAttemptsFor, backoffMs, decideAfterFailure, isTransientExecutionCode } from "./retry-policy"
export { isLegalTaskTransition, isTerminalTask, assertLegalTaskTransition, IllegalTaskTransitionError } from "./state-machine"
export { generateTaskRef, isValidTaskRef, jobIdFor, operationKeyFor, idempotencyScopeFor, triggerIdempotencyKey, TRIGGER_IDEMPOTENCY_PREFIX } from "./ids"
export * from "./types"
