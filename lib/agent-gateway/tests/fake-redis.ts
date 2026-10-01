/**
 * lib/agent-gateway/tests/fake-redis.ts
 *
 * In-memory stand-in for the Upstash client surface the gateway uses
 * (get / set with ex and nx / del / ping), with the semantics the code
 * relies on: SET NX answers "OK" or null, values expire after `ex`
 * seconds, and values round-trip through JSON (as Upstash's automatic
 * serialization does). `failWhen` makes calls for matching keys reject,
 * to simulate an outage of one key space.
 */
import { vi } from "vitest"

type Op = "get" | "set" | "del"

export function createFakeRedis(clock: () => number = () => Date.now()) {
  const store = new Map<string, { value: unknown; expiresAt: number | null }>()
  const outage: { failWhen: ((op: Op, key: string) => boolean) | null } = { failWhen: null }

  const live = (key: string) => {
    const entry = store.get(key)
    if (!entry) return null
    if (entry.expiresAt !== null && entry.expiresAt <= clock()) {
      store.delete(key)
      return null
    }
    return entry
  }
  const check = (op: Op, key: string) => {
    if (outage.failWhen?.(op, key)) throw new Error(`fake redis: ${op} unavailable`)
  }

  const redis = {
    get: vi.fn(async (key: string) => {
      check("get", key)
      return live(key)?.value ?? null
    }),
    set: vi.fn(async (key: string, value: unknown, opts: { ex?: number; nx?: boolean } = {}) => {
      check("set", key)
      if (opts.nx && live(key)) return null
      store.set(key, { value: JSON.parse(JSON.stringify(value)), expiresAt: opts.ex ? clock() + opts.ex * 1000 : null })
      return "OK"
    }),
    del: vi.fn(async (...keys: string[]) => {
      for (const key of keys) check("del", key)
      return keys.filter((key) => store.delete(key)).length
    }),
    ping: vi.fn(async () => "PONG"),
  }

  return {
    redis,
    outage,
    has: (key: string) => live(key) !== null,
    keys: () => Array.from(store.keys()).filter((key) => live(key) !== null),
  }
}
