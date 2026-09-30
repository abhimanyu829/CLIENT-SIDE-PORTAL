/**
 * lib/agent-gateway/health.ts
 *
 * Public health/readiness payload (Phase 1 spec §27). Deliberately
 * minimal — never reveals API keys, database URLs, secret names, token
 * values, internal hosts, or connection IDs. Dependency status is
 * reduced to "ok" | "unavailable" | "disabled", nothing more specific.
 */
import { redis } from "@/lib/redis"
import { db } from "@/lib/db"
import { getGatewayConfig } from "./config"

export interface GatewayHealthPayload {
  status: "ok" | "degraded"
  gateway: "ready" | "disabled"
  dependencies: {
    redis: "ok" | "unavailable" | "disabled"
    backend: "ok" | "unavailable"
  }
}

async function checkBackend(): Promise<"ok" | "unavailable"> {
  try {
    // Reuses the existing db singleton — no new connection, no new client.
    // A trivial count on a small, non-sensitive table is enough to prove
    // the Prisma client can reach the database.
    await db.$queryRaw`SELECT 1`
    return "ok"
  } catch {
    return "unavailable"
  }
}

async function checkRedis(): Promise<"ok" | "unavailable" | "disabled"> {
  if (!redis) return "disabled"
  try {
    await redis.ping()
    return "ok"
  } catch {
    return "unavailable"
  }
}

export async function getGatewayHealth(): Promise<GatewayHealthPayload> {
  const cfg = getGatewayConfig()
  if (!cfg.AGENT_GATEWAY_ENABLED) {
    return {
      status: "degraded",
      gateway: "disabled",
      dependencies: { redis: "disabled", backend: "ok" },
    }
  }

  const [redisStatus, backendStatus] = await Promise.all([checkRedis(), checkBackend()])
  const degraded = redisStatus === "unavailable" || backendStatus === "unavailable"

  return {
    status: degraded ? "degraded" : "ok",
    gateway: "ready",
    dependencies: { redis: redisStatus, backend: backendStatus },
  }
}
