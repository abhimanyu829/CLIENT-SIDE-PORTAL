# 09 — Bug Report (Phase 1)

## Bugs found and fixed during Phase 1

### BUG-1 (P2, test-code-only, fixed) — `seedSubscription` signature mismatch
- Reproduced: 26/95 suite failures with "Unknown subscription" / "No Subscription found".
- Root cause: helper `seedSubscription(row: {id,...})` but every call site used
  two-arg `(id, overrides)` → rows stored under key `undefined`.
- Affected: Phase-1 test suite only (never shipped code).
- Fix: helper signature `(id, overrides = {})`.
- Retest: full suite 95/95 green.

### BUG-2 (P3, test-code-only, fixed) — vitest mock getter snapshot
- Reproduced: mock `@/lib/db` exported `get db() { return fake.db }`; vitest snapshot
  copies exports, freezing the first instance.
- Fix: stable Proxy inside the mock factory + `__setFakeDb()` setter.
- Retest: full suite green. (Turned out BUG-1 was the dominant cause; Proxy retained
  as the robust pattern.)

### BUG-3 (P3, test-code-only, fixed) — migration additive-scan false positive
- Reproduced: `/RENAME/i` matched the SQL comment "no tables ... renamed".
- Fix: strip `--` comment lines before destructive-statement scanning.

### BUG-4 (P3, mine, fixed) — `NODE_ENV` read-only assignment in test
- Reproduced: `tsc --noEmit` TS2540 ×4.
- Fix: `vi.stubEnv` / `vi.unstubAllEnvs`.

## Intentional behaviour change (not a bug — documented hardening)

- `markSubscriptionPastDue`, `pauseSubscription`, `startGracePeriod` on a CANCELLED
  subscription now return `{ success: false }` + warn log instead of writing. Rationale:
  a cancelled subscription must not be revived by late/rogue events. Webhook callers are
  unaffected (soft-skip, no exception). Callers: Stripe/Razorpay webhooks (wrapped in
  try/catch anyway), admin routes, cron.

## Pre-existing issues documented, NOT touched (out of scope)

| ID | Severity | Ownership | Description |
|---|---|---|---|
| PRE-1 | P1 | LEGACY | 40 agent-gateway test failures at HEAD: commit `125d2c5` added 3 product capabilities but did not refresh `manifest.lock.json` / hard-coded tool lists (p8, p12, p14, p15) |
| PRE-2 | P2 | LEGACY | 3 pre-existing `tsc` errors: `products-archive-adapter.ts:44`, `products-update-adapter.ts:61,65` — `"PERMISSION_DENIED"` not in `ExecutionErrorCode` union (same commit) |
| PRE-3 | P2 | PRE-EXISTING | p15 e2e Host-header failures ("Request Host header is not permitted") — environment-dependent (`AGENT_GATEWAY_MCP_ALLOWED_HOSTS`) |
| PRE-4 | P3 | PRE-EXISTING | `next.config.js` warns on unrecognized key `middlewareClientMaxBodySize` |
| PRE-5 | P3 | PRE-EXISTING | Duplicate lockfiles (pnpm-lock.yaml at Desktop root vs package-lock.json) — Turbopack warns |
| PRE-6 | P2 | DATABASE | 7 agent-gateway migrations still unapplied in production (see root `PRODUCTION-CHECKLIST.md`); the Phase-1 migration must ride the same deploy |

No P0. No Phase-1 defect left open.
