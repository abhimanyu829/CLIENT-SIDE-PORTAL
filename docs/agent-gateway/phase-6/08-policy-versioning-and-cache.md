# Phase 6 — Policy Versioning and Cache

## Versioning — immutable, traceable, rollback-safe

Every "change" to a policy creates a brand-new `AgentPolicyVersion` row; no version row is ever `UPDATE`d after creation except its `status` field flipping from `ACTIVE` to `SUPERSEDED` when a newer version supersedes it (`policy-store.ts`'s `createPolicyVersion()`). This is the exact idiom Phase 4/5's own docs point to as the closest existing precedent (`ProductVersion`'s immutable-snapshot-plus-incrementing-integer pattern) — adapted here for policy rules instead of product data.

- **Monotonic version numbers**, enforced by the database itself (a `UNIQUE(policyId, version)` constraint), not just application logic — verified structurally (see `14-database-verification.md`).
- **Active-version pointer**: `AgentPolicy.currentVersionId` always points at the live version; repointing happens in the same logical operation as creating the new version.
- **Disable, don't delete**: `disablePolicy()`/`enablePolicy()` flip `AgentPolicy.enabled`, never delete a row — a disabled policy's full history remains queryable.
- **Rollback creates a new version**, never resurrects an old row: `rollbackToVersion(policyId, targetVersion, actorId)` reads the target historical version's fields and calls `createPolicyVersion()` with them — producing version N+1 with the OLD rules, while versions 1..N remain untouched in the history. Verified by `authz-policy-store.test.ts`'s "rollbackToVersion creates a NEW version copying the target's fields, never resurrecting the old row" test.
- **Traceability**: every `AuthorizationDecision` carries `matchedPolicyId`/`matchedPolicyVersionId`/`matchedPolicyVersion` — an operator can always answer "which exact policy version produced this decision" without needing Phase 11's (not-yet-built) audit ledger.

## Cache — explicit key, TTL, invalidation, and fail-open/fail-closed split

Exactly as the spec requires, stated explicitly rather than left implicit:

- **What is cached**: the resolved policy *data set* (`ResolvedPolicyVersion[]`) — never a decision. There is no "decision cache" anywhere in this codebase. A cache hit only ever changes how fresh the *input data* to `evaluate()` is; the decision itself is always freshly computed.
- **Cache key**: `agent-gateway:policy-set:v1` — a single global key (the active policy set is small at this stage; per-capability sub-keying was considered and rejected as premature complexity without a demonstrated need).
- **TTL**: 30 seconds, fixed and non-configurable — the same value, and the same "don't make a security-relevant cache TTL configurable" rationale, Phase 2's `connection-cache.ts` already established.
- **Invalidation**: `invalidatePolicyCache()` is called by every write path (`createPolicyVersion`, `disablePolicy`, `enablePolicy` — `rollbackToVersion` calls `createPolicyVersion` internally, inheriting the same invalidation) — mirroring `connection-cache.ts`'s "every lifecycle mutation calls invalidate() before returning" convention exactly.
- **Fail-open on cache read/write failure**: a Redis GET or SET failure falls through to (or simply skips past, for SET) a direct database read — this cache is a pure performance optimization, never the sole source of truth, matching `connection-cache.ts`'s stated rationale (the database always remains the authoritative fallback for *this specific* cache).
- **Fail-CLOSED on a genuine DB failure**: this is the one place Phase 6's cache posture differs from Phase 2's `connection-cache.ts` on purpose — if the underlying database read itself throws (not just a cache miss), `loadActivePolicySet()` does **not** catch the error and does **not** return an empty array; it re-throws, and the caller (`authorizer.ts`) classifies that as `POLICY_UNAVAILABLE`, enforced as a deny. An empty array from "nobody configured any policy yet" (a legitimate, correctly-handled state) must never be confused with an empty array produced by swallowing a real failure — this module never lets the second case masquerade as the first.

## "Never allow stale ALLOW decisions beyond defined security bounds"

Because decisions are never cached (only policy *data* is), the practical staleness bound on any authorization outcome is exactly the cache TTL (30 seconds) plus however long a policy-management operation takes to call `invalidatePolicyCache()` — and every write path calls it synchronously, in the same request, before returning to its caller. Verified directly by `authz-policy-cache.test.ts`'s "policy revoked, next request" test: disabling a policy and then immediately calling `loadActivePolicySet()` again returns a set that excludes the disabled policy, not a stale cached one.
