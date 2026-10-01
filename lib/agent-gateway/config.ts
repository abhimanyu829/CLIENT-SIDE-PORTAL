/**
 * lib/agent-gateway/config.ts
 *
 * Strongly validated Agent Gateway configuration. Follows the same
 * fail-fast zod pattern as lib/env.ts, but is deliberately its own
 * module — the gateway must not widen or depend on the main app's env
 * schema, and the main app must be unaffected if gateway config is
 * absent (the gateway simply reports GATEWAY_DISABLED).
 *
 * No secret value is ever logged or returned from any diagnostic here.
 */
import { z } from "zod"

const optStr = z.string().min(1).optional().or(z.literal("").transform(() => undefined))

const gatewayConfigSchema = z.object({
  /** Master switch. Defaults to disabled — the gateway is opt-in. */
  AGENT_GATEWAY_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  /** Externally visible host, for documentation/health output only (never trusted for auth). */
  AGENT_GATEWAY_HOST: optStr,

  AGENT_GATEWAY_MAX_BODY_BYTES: z.coerce.number().int().positive().optional().default(262_144), // 256KB
  AGENT_GATEWAY_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().optional().default(30_000),

  AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().optional().default(60),
  AGENT_GATEWAY_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().optional().default(1000),

  /** Allowed clock skew for signed-request timestamps, both directions. */
  AGENT_GATEWAY_MAX_CLOCK_SKEW_SECONDS: z.coerce.number().int().positive().optional().default(300),

  /** Nonce TTL — must exceed max clock skew so a nonce can't expire before its timestamp window closes. */
  AGENT_GATEWAY_NONCE_TTL_SECONDS: z.coerce.number().int().positive().optional().default(600),

  /** Enables the HMAC signed-request authenticator. Bearer auth is always available. */
  AGENT_GATEWAY_SIGNING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),

  AGENT_GATEWAY_ENVIRONMENT: z.enum(["development", "production", "test"]).optional().default("development"),

  /**
   * Phase 15 — when on, a capability with no AgentRollout row for this
   * environment is DISABLED (explicit release required). Off (default): a
   * missing row keeps the pre-Phase-15 behaviour ("legacy ACTIVE"), so
   * deploying Phase 15 changes nothing until rollouts are configured.
   * Kill switches apply either way.
   */
  AGENT_GATEWAY_ROLLOUT_ENFORCED: z
    .string()
    .optional()
    .transform((v) => v === "1" || v === "true"),
})

export type AgentGatewayConfig = z.infer<typeof gatewayConfigSchema>

let cached: AgentGatewayConfig | null = null

/**
 * Lazily parsed (not at module load) so importing this file never crashes
 * the host Next.js process — an invalid/missing gateway config degrades to
 * GATEWAY_DISABLED behavior at the route boundary instead of a hard throw.
 */
export function getGatewayConfig(): AgentGatewayConfig {
  if (cached) return cached
  const parsed = gatewayConfigSchema.safeParse(process.env)
  if (!parsed.success) {
    // Fail closed, not open: an invalid config must not be treated as "enabled".
    cached = gatewayConfigSchema.parse({ AGENT_GATEWAY_ENABLED: "0" })
    return cached
  }
  cached = parsed.data
  return cached
}

/** Test-only: clears the memoized config so tests can re-parse under different env vars. */
export function __resetGatewayConfigForTests(): void {
  cached = null
}

/**
 * Whether this process is a production deployment: the gateway is
 * configured for production, or Node runs in production mode (any
 * `next start` deployment). Used where a missing safety dependency must
 * never be silently tolerated (execution/idempotency/idempotency-guard.ts).
 */
export function isProductionDeployment(): boolean {
  return getGatewayConfig().AGENT_GATEWAY_ENVIRONMENT === "production" || process.env.NODE_ENV === "production"
}
