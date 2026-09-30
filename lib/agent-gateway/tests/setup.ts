/**
 * lib/agent-gateway/tests/setup.ts
 *
 * Test-environment bootstrap. Sets required env vars BEFORE any module
 * under test is imported (lib/env.ts parses eagerly at import time), and
 * mocks the app-level singletons (db, redis) so the gateway test suite
 * never touches a real database or Redis instance.
 */
import { vi } from "vitest"

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test"
// NODE_ENV is typed read-only by @types/node; vitest already sets it to
// "test" when running under `vitest run`, so no assignment is needed here.

// Phase 1's authenticator tests exercise EnvCredentialStore directly and
// predate the Phase 2 DB-backed default — pin the store selector so those
// existing tests keep testing exactly what they always tested, without
// each one needing to know Phase 2 changed the default. Phase 2's own
// tests for the DB-backed store explicitly unset/override this via
// vi.stubEnv where they need the real default behavior.
process.env.AGENT_GATEWAY_CREDENTIAL_STORE ??= "env"

vi.mock("@/lib/db", () => ({
  db: {
    $queryRaw: vi.fn(async () => [{ "?column?": 1 }]),
  },
}))

// NOTE: @/lib/redis is intentionally NOT globally mocked here. Tests that
// need a specific redis behavior (available vs. unavailable) mock it
// per-file with vi.mock("@/lib/redis", ...) so both code paths (Redis
// configured vs. not configured) can be exercised.
