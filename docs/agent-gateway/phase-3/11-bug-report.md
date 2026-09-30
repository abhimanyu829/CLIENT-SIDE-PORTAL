# Phase 3 — Bug Report

## Methodology

Implement -> unit test -> integration test -> failure test -> security test -> regression test -> inspect failures -> reproduce -> classify (P0-P3, and PRE-EXISTING / PHASE-3-INTRODUCED / OUT-OF-SCOPE) -> fix P0/P1 immediately, fix P2 required for correctness, fix P3 only if low-risk and in-scope -> reproduce -> fix -> unit retest -> integration retest -> security retest -> full regression again.

## Bugs found and fixed (both PHASE-3-INTRODUCED, both fixed and retested this session)

### Bug A — Raw `Error` leaking past the `CapabilityError` contract

**Classification**: P1, PHASE-3-INTRODUCED.

**Where found**: Writing `capability-security.test.ts`'s id-injection tests (`registry.resolve("../../etc/passwd")` etc.) — 7 of 9 initial security-test failures, plus 2 of 14 `capability-registry.test.ts` failures.

**Root cause**: `capabilities/id.ts`'s `assertValidCapabilityId()` and `parseCapabilityRef()` throw plain `Error` objects on validation failure (by design — `id.ts` is a low-level, dependency-free parsing module that should not need to import the registry's error type). `registry.ts`'s `register()` and `resolve()` called these directly without wrapping, so a malformed id/ref caused a raw `Error` to propagate out of the registry's public API instead of the documented `CapabilityError` contract. This violated the exit condition "stable machine-readable capability errors... never leak... internal implementation details" in spirit (a raw `Error` from a different module is exactly the kind of contract leak the spec warns against) and would have broken every caller written against `instanceof CapabilityError`.

**Fix**: Added `assertValidCapabilityIdOrThrow()` and `parseCapabilityRefOrThrow()` wrapper functions inside `registry.ts` that catch the raw `Error` and rethrow as `CapabilityError("INVALID_INPUT", message)`, preserving the original descriptive message (which contains no secret/sensitive detail — only the malformed id string itself, already caller-supplied) while normalizing the type. `register()` and `resolve()` now call these wrappers instead of the raw `id.ts` functions directly.

**Retest**: `capability-registry.test.ts` (41 tests) and `capability-security.test.ts` (18 tests) both fully green after the fix. Full 235-test regression re-run, zero other impact.

### Bug B — Shallow freeze left nested metadata mutable

**Classification**: P1, PHASE-3-INTRODUCED.

**Where found**: `capability-security.test.ts`'s "a caller cannot mutate a stored definition's permission after registration" test.

**Root cause**: `register()`, `deprecate()`, and `disable()` originally called `Object.freeze({ ...def })` — a SHALLOW freeze. This freezes the top-level object (so e.g. `def.name = "x"` throws) but every nested object (`permission`, `resource`, `sideEffects`, `idempotency`, `async`, `rollback`, `executionReference`, each entry of `errorContract`) remained a plain, mutable object. A caller holding a reference returned by `resolve()`/`get()`/`list()` could execute `def.permission.permission = "admin:everything"` successfully, silently corrupting the registry's own stored state (since no defensive copy is made on read) — this directly violated the exit condition "registry is immutable to clients."

**Fix**: Added `freezeDefinition()` (replaces the direct `Object.freeze({...def})` calls) and a recursive helper `deepFreezePlainValue()` that freezes every field's nested object/array graph, deliberately EXCLUDING `inputSchema`/`outputSchema` (zod `ZodType` instances — these must remain functional class instances, not frozen plain objects, or `.safeParse()` would break).

**Retest**: The specific security test now passes; re-ran the full `capability-registry.test.ts` (including the immutability-specific tests #20/#20b) and `capability-security.test.ts` suites — all green. Full 235-test regression re-run, zero other impact.

## Bugs NOT found in scope

No bugs were found in:
- `capabilities/types.ts`, `capabilities/manifest.ts`, `capabilities/index.ts` — no test failures traced to these files.
- Any Phase 1/Phase 2 file — the full 127-test pre-existing suite passed unchanged before, during, and after every Phase 3 fix, confirming zero cross-phase regression.
- The production build or lint baseline — both matched their pre-Phase-3 state exactly (122 lint problems, 1 pre-existing typecheck error, successful build with 250 routes).

## Pre-existing issues (documented, NOT touched)

- `app/api/feedback/route.ts:128` — `role: "USER"` is not a valid Prisma `Role` enum value. This is the SAME single pre-existing typecheck error flagged in Phase 1 and Phase 2's final reports. Confirmed still present, confirmed NOT modified.
- The orphaned `prisma/migrations/20260916090000_catalog_intelligence` migration (pre-Phase-0, flagged "do not touch" in Phase 2's final report) remains untouched — Phase 3 made zero database changes of any kind.

## Out-of-scope findings

None identified during Phase 3 work. No new dangerous primitive, no new generic mutation endpoint, and no new stale-role-string bug was discovered — Phase 3's surface area (a new, isolated, dependency-free module) did not intersect with any area where Phase 0's `BUG-BASELINE.md` findings live.
