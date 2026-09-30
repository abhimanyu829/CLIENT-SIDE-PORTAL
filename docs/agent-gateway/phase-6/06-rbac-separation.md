# Phase 6 — RBAC Separation (Human Authority ≠ Agent Authority)

## The two systems this phase found (Step 0 audit)

1. **`lib/permissions.ts`** — a string-literal `"action:resource"` RBAC vocabulary (`PERMISSIONS.READ_PRODUCTS = "read:products"`, etc.) plus `ROLE_PERMISSIONS`/`hasPermission()`/`requirePermission()`. No call site under `app/` actually invokes `requirePermission()` or reads `PERMISSIONS` at runtime today — it is the vocabulary Phase 3's `CapabilityDefinition.permission.permission` field was already documented to reuse (see `capabilities/manifest.ts`'s comments), not a live enforcement path in the human-facing app.
2. **`lib/subadmin-permission-policy.ts`** + **`lib/admin-auth.ts`**'s `requireAdmin()`/`requireSuperAdmin()` — the REAL system driving human admin access: a DB-backed resource×action matrix per subadmin, refetching the human's `Role` from Postgres on every check ("zero trust," never trusting a session/JWT claim).

## What Phase 6 reuses, and how

`rbac-bridge.ts` re-exports `lib/permissions.ts`'s `PERMISSIONS` values as `KNOWN_HUMAN_PERMISSIONS` — a read-only reference so an authorization policy's declarative conditions *can* reference the same permission vocabulary a capability already carries (`capability.permission.permission`, e.g. `"read:products"`), without inventing a parallel `agent.products.read`-style namespace. This satisfies the spec's explicit instruction: "Reuse existing RBAC permissions... Do NOT create duplicate versions... unless a genuine semantic separation is required." No genuine semantic separation was identified, so none was created.

## What Phase 6 never touches

Zero imports of `lib/admin-auth.ts`, `lib/subadmin-permission-policy.ts`, or `requireAdmin`/`requireSuperAdmin` anywhere under `lib/agent-gateway/authorization/`. Verified directly by `authz-rbac-integration.test.ts`'s "no lib/agent-gateway/authorization/*.ts source file imports lib/admin-auth.ts..." test, and independently confirmed by inspection during this phase's Step 0 audit (grep for those identifiers across the new module returned zero hits).

## The core separation, proven by test

`authz-rbac-integration.test.ts`'s "human admin authority != agent runtime authority" test constructs a connection whose `ownerId` — by the test's own naming convention — represents a human `SUPER_ADMIN`'s user id, then asserts that `evaluate()` still denies a `HIGH_RISK_MUTATION` capability for that connection when no `AgentPolicy` exists granting it. The engine has **no code path** that looks up a human `User.role`, checks Clerk session claims, or otherwise asks "is the human behind this ownerId an administrator" — `AuthorizationContext` doesn't even have a `role` field (verified by `authz-security.test.ts` item #18: `"role" in authzCtx` is `false`). An agent connection's authority is derived exclusively from `AgentPolicy` rows explicitly scoped to it (by `OWNER`/`TEAM`/`CONNECTION`/`CAPABILITY`/`RESOURCE`), never from "the human who happens to own this connection is powerful."

## Human Admin Override (per the spec's explicit section)

Creating or modifying an `AgentPolicy`/`AgentPolicyVersion` is, by design, a **human authorization event** — `policy-store.ts`'s write functions (`createPolicyVersion`, `disablePolicy`, `enablePolicy`, `rollbackToVersion`) all require an `actorId`, and are documented (in their own doc comments) as intended to be called only from an already-authorized administrative code path — the same convention Phase 2's `AgentConnectionService.create()` already follows (it doesn't check authorization itself; its callers, the admin API routes, must have already verified the actor via `requireSuperAdmin()`/`requireAdmin()` before calling in). **None of these write functions are exposed as an MCP tool, an agent capability, or reachable from any `app/api/agent-gateway/*` route** — an AI agent has no mechanism, direct or indirect, to create, modify, or delete its own (or any) authorization policy. `seed.ts`'s `seedBaselineReadPolicies()` is likewise a plain exported function meant for explicit, human-invoked bootstrap (e.g. a one-off script or a future Phase 10 admin action) — never auto-run at import time, never wired into any singleton getter.

## Governance UI — explicitly deferred

Per the spec: "Full governance UI belongs to Phase 10. Phase 6 should provide backend policy models/services/interfaces." This phase delivers exactly that — `policy-store.ts`'s CRUD-ish functions and `simulate.ts`'s `simulateAuthorization()` are the backend surface a future governance UI would call into — and does not build, modify, or extend any existing admin panel page (`app/(admin)/` is untouched by this phase, confirmed in the git diff audit).
