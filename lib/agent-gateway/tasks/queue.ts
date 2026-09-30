/**
 * lib/agent-gateway/tasks/queue.ts
 *
 * The Task Engine's view of the queue. Production uses the EXISTING BullMQ
 * stack: `agentTaskQueue` from lib/queue.ts (same createLazyQueue
 * convention, same Redis connection as every other queue). No second queue
 * framework, Redis client or worker application is introduced.
 *
 * Fail closed: lib/queue.ts's lazy proxy silently no-ops when REDIS_URL is
 * unset. The engine never relies on that — an enqueue that does not return
 * a real job (or does not finish within the enqueue timeout) is
 * QUEUE_UNAVAILABLE, and the task is never reported as QUEUED.
 *
 * The job payload carries references only — never input, credentials,
 * tokens or secrets. The worker treats the stored task row as the only
 * source of execution parameters and rejects a payload that disagrees.
 */
import { z } from "zod"
import { env } from "@/lib/env"
import { agentTaskQueue, AGENT_TASK_JOBS } from "@/lib/queue"

export const TASK_JOB_PAYLOAD_SCHEMA = z
  .object({
    taskId: z.string().min(1).max(64),
    attempt: z.number().int().min(1).max(10),
    capabilityId: z.string().min(1).max(80),
    capabilityVersion: z.number().int().min(1),
    adapterId: z.string().min(1).max(80),
    environment: z.string().min(1).max(32),
    idempotencyRef: z.string().max(200).nullable(),
  })
  .strict()

export type TaskJobPayload = z.infer<typeof TASK_JOB_PAYLOAD_SCHEMA>

export class TaskQueueUnavailableError extends Error {
  constructor() {
    super("The task queue is unavailable.")
    this.name = "TaskQueueUnavailableError"
  }
}

export interface EnqueueOptions {
  jobId: string
  delayMs?: number
}

export interface TaskQueuePort {
  /** False when no queue backend is configured at all (e.g. REDIS_URL unset). */
  isConfigured(): boolean
  /** Adds one attempt job. Throws TaskQueueUnavailableError unless a job is confirmed. */
  enqueue(payload: TaskJobPayload, options: EnqueueOptions): Promise<void>
  /** Best-effort removal of a pending (waiting/delayed) job. Never throws. */
  removePending(jobId: string): Promise<void>
  /** True when a job with this id currently exists. Throws when the queue cannot answer. */
  hasJob(jobId: string): Promise<boolean>
}

/** Structural subset of BullMQ's Queue used here (keeps the adapter testable against a real Queue). */
export interface BullQueueLike {
  add(name: string, data: unknown, opts?: Record<string, unknown>): Promise<unknown>
  getJob(jobId: string): Promise<unknown>
  remove(jobId: string): Promise<unknown>
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TaskQueueUnavailableError()), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Per-job BullMQ options. BullMQ attempts only cover failures BEFORE an attempt is claimed. */
const ATTEMPT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
}

export class BullTaskQueue implements TaskQueuePort {
  constructor(
    private readonly queue: BullQueueLike,
    private readonly configured: () => boolean,
    private readonly enqueueTimeoutMs: number
  ) {}

  isConfigured(): boolean {
    return this.configured()
  }

  async enqueue(payload: TaskJobPayload, options: EnqueueOptions): Promise<void> {
    if (!this.configured()) throw new TaskQueueUnavailableError()
    let job: unknown
    try {
      job = await withTimeout(
        this.queue.add(AGENT_TASK_JOBS.EXECUTE, payload, {
          ...ATTEMPT_JOB_OPTIONS,
          jobId: options.jobId,
          delay: options.delayMs && options.delayMs > 0 ? options.delayMs : undefined,
        }),
        this.enqueueTimeoutMs
      )
    } catch {
      throw new TaskQueueUnavailableError()
    }
    // The lazy proxy returns undefined when Redis is not configured: never treat that as success.
    if (!job || typeof job !== "object" || !(job as { id?: unknown }).id) throw new TaskQueueUnavailableError()
  }

  async removePending(jobId: string): Promise<void> {
    if (!this.configured()) return
    try {
      await withTimeout(this.queue.remove(jobId), this.enqueueTimeoutMs)
    } catch {
      // Best effort: a job that still runs finds the task terminal and exits without dispatch.
    }
  }

  async hasJob(jobId: string): Promise<boolean> {
    if (!this.configured()) throw new TaskQueueUnavailableError()
    const job = await withTimeout(this.queue.getJob(jobId), this.enqueueTimeoutMs)
    return !!job
  }
}

let defaultQueue: TaskQueuePort | null = null

/** The production queue: lib/queue.ts's agentTaskQueue on the existing Redis. */
export function getDefaultTaskQueue(enqueueTimeoutMs: number): TaskQueuePort {
  if (!defaultQueue) {
    defaultQueue = new BullTaskQueue(agentTaskQueue as unknown as BullQueueLike, () => !!env.REDIS_URL, enqueueTimeoutMs)
  }
  return defaultQueue
}
