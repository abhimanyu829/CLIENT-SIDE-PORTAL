# 11 — Bug Report (Phase 3)

## Bugs found and fixed (all test-authoring or test-infrastructure)

| ID | Sev | Root cause | Fix |
|---|---|---|---|
| BUG-E-1 | P3 | Test claimed `a.b` was an invalid key; the regex admits 2-segment short keys | corrected the expectation; regex unchanged |
| BUG-E-2 | P3 | Contract test passed `resourceId` with default OWNER scope (service correctly rejects) | provisioning call omits resourceId; scoping covered elsewhere |
| BUG-E-3 | P3 | Expired-grant fixtures passed past `expiresAt` with server-default `startsAt=now` → legitimate `expiresAt must be after startsAt` rejection | fixtures now set an earlier `startsAt` |
| BUG-E-4 | P3 | `getEntitlement` winner test passed `expiresAt: null` explicitly; zod `z.date()` rejects null | omit the field (server default = null) |
| BUG-E-5 | P2 | Resolver resource filter originally kept OWNER grants in resource-scoped queries → cross-resource leak (`shop_456` wrongly ALLOW) | documented policy: resource queries keep GLOBAL + exact RESOURCE grants only; OWNER excluded |
| BUG-E-6 | P3 | Cache snapshot test violated invalidation semantics (service correctly invalidates on grant) | inject the second grant directly into the store (no invalidation) |
| BUG-E-7 | P3 | `toBe(value, message)` not in vitest 2 types | removed message args (~9 sites) |
| BUG-E-8 | P3 | Schema regex broken by `@default("{}")` brace in `[^}]*` matcher | non-greedy `[\s\S]*?` matcher |

No production-code bug found after the initial suite run beyond BUG-E-5 (resolver
policy, P2, fixed + retested).

## Pre-existing issues (out of scope, not touched)

- 3 gateway `tsc` errors + 40 gateway suite failures (HEAD commit `125d2c5`;
  stash-proven pre-existing in Phase 1; Gateway suite NOT re-run in Phase 3 —
  zero gateway files touched).
- 6 legacy `Catalog*` tables in the live DB, absent from schema.prisma (drift
  predates Phase 3; the migration excludes them).
- Supabase availability: `migrate deploy` and live DB verification blocked by
  `P1001` during this phase (environmental, not code).

No P0. No open Phase-3 defect.