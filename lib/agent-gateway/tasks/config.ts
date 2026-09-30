/**
 * lib/agent-gateway/tasks/config.ts
 *
 * Phase 8 configuration. Same lazily-parsed, fail-safe zod pattern as
 * lib/agent-gateway/config.ts and mcp/config.ts. An invalid value falls back
 * to the documented defaults with the task tools DISABLED (fail closed).
 */
import { z } from "zod"

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const taskConfigSchema = z.object({
  /** Master switch for the async task tools. Opt-in, like every gateway surface. */
  AGENT_GATEWAY_TASKS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /** Max time a task may wait in QUEUED / RETRY_QUEUED before it expires. */
  AGENT_GATEWAY_TASK_QUEUE_TIMEOUT_MS: z.coerce.number().int().min(1_000).optional().default(15 * MINUTE),
  /** Max duration of one RUNNING attempt. */
  AGENT_GATEWAY_TASK_EXECUTION_TIMEOUT_MS: z.coerce.number().int().min(1_000).optional().default(60_000),
  /** Overall deadline from creation (capped by a bound approval's expiry). */
  AGENT_GATEWAY_TASK_DEADLINE_MS: z.coerce.number().int().min(10_000).optional().default(60 * MINUTE),
  /** How long an enqueue may take before it counts as QUEUE_UNAVAILABLE. */
  AGENT_GATEWAY_TASK_ENQUEUE_TIMEOUT_MS: z.coerce.number().int().min(100).optional().default(5_000),
  /** A STARTING task older than this is treated as an interrupted pre-dispatch attempt. */
  AGENT_GATEWAY_TASK_STARTING_GRACE_MS: z.coerce.number().int().min(1_000).optional().default(2 * MINUTE),
  AGENT_GATEWAY_TASK_MAX_INPUT_BYTES: z.coerce.number().int().min(256).optional().default(65_536),
  AGENT_GATEWAY_TASK_MAX_RESULT_BYTES: z.coerce.number().int().min(1_024).optional().default(262_144),
  AGENT_GATEWAY_TASK_RESULT_RETENTION_MS: z.coerce.number().int().min(MINUTE).optional().default(7 * DAY),
  AGENT_GATEWAY_TASK_RETENTION_MS: z.coerce.number().int().min(MINUTE).optional().default(30 * DAY),
  AGENT_GATEWAY_TASK_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).optional().default(5),
})

export interface TaskEngineConfig {
  enabled: boolean
  queueTimeoutMs: number
  executionTimeoutMs: number
  deadlineMs: number
  enqueueTimeoutMs: number
  startingGraceMs: number
  maxInputBytes: number
  maxResultBytes: number
  resultRetentionMs: number
  taskRetentionMs: number
  workerConcurrency: number
}

function toConfig(parsed: z.infer<typeof taskConfigSchema>): TaskEngineConfig {
  return {
    enabled: parsed.AGENT_GATEWAY_TASKS_ENABLED,
    queueTimeoutMs: parsed.AGENT_GATEWAY_TASK_QUEUE_TIMEOUT_MS,
    executionTimeoutMs: parsed.AGENT_GATEWAY_TASK_EXECUTION_TIMEOUT_MS,
    deadlineMs: parsed.AGENT_GATEWAY_TASK_DEADLINE_MS,
    enqueueTimeoutMs: parsed.AGENT_GATEWAY_TASK_ENQUEUE_TIMEOUT_MS,
    startingGraceMs: parsed.AGENT_GATEWAY_TASK_STARTING_GRACE_MS,
    maxInputBytes: parsed.AGENT_GATEWAY_TASK_MAX_INPUT_BYTES,
    maxResultBytes: parsed.AGENT_GATEWAY_TASK_MAX_RESULT_BYTES,
    resultRetentionMs: parsed.AGENT_GATEWAY_TASK_RESULT_RETENTION_MS,
    taskRetentionMs: parsed.AGENT_GATEWAY_TASK_RETENTION_MS,
    workerConcurrency: parsed.AGENT_GATEWAY_TASK_WORKER_CONCURRENCY,
  }
}

/** Documented defaults (also the fallback for an invalid configuration, with tasks disabled). */
export const DEFAULT_TASK_ENGINE_CONFIG: TaskEngineConfig = toConfig(taskConfigSchema.parse({}))

let cached: TaskEngineConfig | null = null

export function getTaskEngineConfig(): TaskEngineConfig {
  if (cached) return cached
  const parsed = taskConfigSchema.safeParse(process.env)
  cached = parsed.success ? toConfig(parsed.data) : { ...DEFAULT_TASK_ENGINE_CONFIG, enabled: false }
  return cached
}

/** Test-only: clears the memoized config. */
export function __resetTaskEngineConfigForTests(): void {
  cached = null
}
