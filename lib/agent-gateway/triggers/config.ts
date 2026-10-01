/**
 * lib/agent-gateway/triggers/config.ts
 *
 * Phase 9 configuration (same lazily-parsed zod pattern as the other
 * gateway config modules). Triggers create Phase 8 tasks, so they are only
 * effective when AGENT_GATEWAY_TASKS_ENABLED is also on.
 */
import { z } from "zod"
import { getTaskEngineConfig } from "../tasks/config"

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

const schema = z.object({
  AGENT_GATEWAY_TRIGGERS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
  /** Bounded frequency: minimum gap between two occurrences of a cron schedule. */
  AGENT_GATEWAY_TRIGGER_MIN_INTERVAL_MS: z.coerce.number().int().min(MINUTE).optional().default(5 * MINUTE),
  /** An occurrence fired later than this is "missed" and handled by the missed-run policy. */
  AGENT_GATEWAY_TRIGGER_LATE_TOLERANCE_MS: z.coerce.number().int().min(10_000).optional().default(2 * MINUTE),
  /** CATCH_UP_ONCE only catches up if the newest missed occurrence is within this window. */
  AGENT_GATEWAY_TRIGGER_CATCH_UP_WINDOW_MS: z.coerce.number().int().min(MINUTE).optional().default(DAY),
  /** A one-time schedule may be at most this far in the future. */
  AGENT_GATEWAY_TRIGGER_MAX_ONCE_HORIZON_MS: z.coerce.number().int().min(DAY).optional().default(365 * DAY),
  AGENT_GATEWAY_WEBHOOK_MAX_BODY_BYTES: z.coerce.number().int().min(256).max(1_048_576).optional().default(65_536),
  AGENT_GATEWAY_TRIGGER_TICK_BATCH: z.coerce.number().int().min(1).max(1000).optional().default(100),
})

export interface TriggerConfig {
  enabled: boolean
  minIntervalMs: number
  lateToleranceMs: number
  catchUpWindowMs: number
  maxOnceHorizonMs: number
  webhookMaxBodyBytes: number
  tickBatch: number
}

function toConfig(p: z.infer<typeof schema>): TriggerConfig {
  return {
    enabled: p.AGENT_GATEWAY_TRIGGERS_ENABLED && getTaskEngineConfig().enabled,
    minIntervalMs: p.AGENT_GATEWAY_TRIGGER_MIN_INTERVAL_MS,
    lateToleranceMs: p.AGENT_GATEWAY_TRIGGER_LATE_TOLERANCE_MS,
    catchUpWindowMs: p.AGENT_GATEWAY_TRIGGER_CATCH_UP_WINDOW_MS,
    maxOnceHorizonMs: p.AGENT_GATEWAY_TRIGGER_MAX_ONCE_HORIZON_MS,
    webhookMaxBodyBytes: p.AGENT_GATEWAY_WEBHOOK_MAX_BODY_BYTES,
    tickBatch: p.AGENT_GATEWAY_TRIGGER_TICK_BATCH,
  }
}

export const DEFAULT_TRIGGER_CONFIG: TriggerConfig = { ...toConfig(schema.parse({})), enabled: false }

let cached: TriggerConfig | null = null

export function getTriggerConfig(): TriggerConfig {
  if (cached) return cached
  const parsed = schema.safeParse(process.env)
  cached = parsed.success ? toConfig(parsed.data) : { ...DEFAULT_TRIGGER_CONFIG }
  return cached
}

/** Test-only. */
export function __resetTriggerConfigForTests(): void {
  cached = null
}
