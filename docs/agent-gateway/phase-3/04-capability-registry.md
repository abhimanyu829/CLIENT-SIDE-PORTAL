# Phase 3 — Capability Registry

`lib/agent-gateway/capabilities/registry.ts`'s `CapabilityRegistry` class is the sole store of `CapabilityDefinition`s.

## Public operations

| Method | Behavior |
|---|---|
| `register(def)` | Validates well-formedness (see below), rejects duplicates, deep-freezes, stores. Throws `CapabilityError`, never a raw `Error`. |
| `has(id)` | Returns `false` for a malformed id or an id with zero registered versions — never throws. |
| `get(id)` | Alias of `resolve(id)` that returns `null` instead of throwing on `CAPABILITY_NOT_FOUND` (other errors, e.g. `CAPABILITY_DISABLED`, still throw). |
| `getVersion(id, version)` | Returns the exact `(id, version)` definition or `null`. Does not apply disabled/deprecated fail-closed logic — callers wanting that use `resolve()`. |
| `resolve(ref)` | The fail-closed lookup. See `03-capability-id-versioning.md`. |
| `list(options?)` | Deterministic, insertion-ordered list. Excludes `DISABLED`/`FORBIDDEN` by default; both can be explicitly included via `{ includeDisabled, includeForbidden }`. |
| `validateInput(ref, input)` | `resolve()` + zod validation combined. Throws `FORBIDDEN` for forbidden capabilities before ever touching a schema. |
| `deprecate(id, version)` | Marks a specific version `DEPRECATED` in place. |
| `disable(id, version)` | Marks a specific version `DISABLED` in place. |

## Well-formedness checks (`register()`)

Every one of these throws `CapabilityError` and stores nothing — a definition is either fully accepted or fully rejected, never partially stored:

1. `id` matches the required shape (`id.ts`).
2. `version` is an integer >= 1.
3. `operationType` is one of the four valid risk tiers.
4. `exposure` is one of the six valid exposure levels.
5. `exposure === "FORBIDDEN"` implies `executionReference === null` — a forbidden capability can never carry a live adapter reference.
6. Every non-`FORBIDDEN`, non-`DISABLED` capability must declare a non-null `inputSchema`.
7. If `executionReference` is present, its `adapterKey` must itself be a valid capability-id-shaped string.
8. The definition passes the dangerous-primitive scan (`dangerous-primitive-guard.ts`) on `id`, `domain`, and `executionReference.adapterKey`.
9. No duplicate `(id, version)` pair already exists (`CONFLICT`).

## Immutability

`register()`, `deprecate()`, and `disable()` all store a **deep-frozen** copy of the definition (`freezeDefinition()`), which recursively freezes every plain-object/array field (`permission`, `resource`, `sideEffects`, `idempotency`, `async`, `rollback`, `executionReference`, `errorContract`) — deliberately **excluding** `inputSchema`/`outputSchema`, since those are zod `ZodType` instances (library objects with internal state and methods) that must remain functional, not frozen.

This closes two real gaps found during Phase 3 testing (see `10-test-report.md` / `11-bug-report.md`):
- A caller mutating the object it originally passed to `register()` after the call returns cannot retroactively change the stored definition.
- A caller obtaining a definition via `resolve()`/`get()`/`list()` and mutating a nested field (e.g. `def.permission.permission = "admin:everything"`) throws instead of silently succeeding.

## Determinism

`list()` iterates an internal `insertionOrder: string[]` array, never `Map` iteration order directly relied upon for anything semantic — though in modern JS engines `Map` iteration is itself insertion-ordered, the explicit array makes this guarantee independent of engine behavior and easy to reason about. Calling `list()` twice in a row, or from two different test files, always produces the same order.

## Fail-closed guarantees

- A malformed manifest entry throws immediately at `register()` — it is never partially stored (`10-test-report.md`'s failure-test suite specifically verifies this: a `try { register(bad) } catch {}` followed by `has(bad.id)` returns `false`).
- `resolve()` on a disabled capability throws `CAPABILITY_DISABLED`, never silently substitutes a different version.
- `resolve()` on a nonexistent id throws `CAPABILITY_NOT_FOUND`, never crashes with an unrelated error.
- `validateInput()` on a `FORBIDDEN` capability throws `FORBIDDEN` before ever reaching schema validation — knowing a forbidden capability's exact id is never sufficient to get any further.
