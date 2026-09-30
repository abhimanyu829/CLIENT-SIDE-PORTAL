# Phase 3 — Capability ID & Versioning Rules

## ID format

`domain.action` — exactly one `.` separator, lowercase-leading segments, no path-traversal characters, no whitespace, no `$`, max 80 characters. Enforced by `lib/agent-gateway/capabilities/id.ts`'s `assertValidCapabilityId()`.

Examples:

| Valid | Invalid | Why invalid |
|---|---|---|
| `products.list` | `prisma.Product.update` | Implementation/table terminology, not business intent |
| `products.updatePricing` | `products.../etc/passwd` | Path traversal |
| `subscriptions.get` | `database.query` | Generic database access shape (also rejected by the dangerous-primitive guard) |
| `deployments.createDeployment` | `agent.executeFunction` | Generic function-execution shape |

IDs represent **business intent**, never implementation details — this is enforced structurally, not just by convention: the dangerous-primitive guard (`06-risk-and-side-effect-metadata.md` / `dangerous-primitive-guard.ts`) independently rejects table/ORM-shaped tokens even if they happen to pass the regex.

## Version format

A separate required `version: number` field (integer >= 1) — not semver. Deliberately the smallest reliable model, per the spec's explicit instruction not to build a complicated semver framework unless needed.

A capability reference string may include an explicit version suffix: `products.update@v2`. The suffix regex (`^v([1-9][0-9]{0,4})$`) rejects `@vlatest`, `@v0`, `@v-1`, and any non-numeric suffix.

## Storage key

`storageKey(id, version)` produces the deterministic composite key `${id}@v${version}` — the registry's `Map` is keyed by this string, never by `id` alone (which would collide across versions) and never by insertion index (which would be non-deterministic across manifest edits).

## Resolution rules

- `resolve("products.list@v2")` — exact version. Throws `CAPABILITY_NOT_FOUND` if that exact version was never registered. Throws `CAPABILITY_DISABLED` if that version is disabled (see `07-security-boundary.md`) — never silently falls back to a different version.
- `resolve("products.list")` — no version given. Returns the **highest-numbered, non-deprecated, non-disabled** registered version. This is deterministic (sorted by version number), never "whichever was registered most recently" (which would depend on manifest edit order).
- If every version of an id is deprecated/disabled, `resolve()` without a version still resolves the highest version number for a clear signal, but continues to fail closed with `CAPABILITY_DISABLED` if that highest version is specifically disabled.

## No silent breaking changes

- `register()` rejects a duplicate `(id, version)` pair outright (`CONFLICT`) — there is no "overwrite" operation. To change a capability's contract, register a **new version**.
- `deprecate(id, version)` marks a specific version deprecated in place (still resolvable by exact reference, excluded from default "latest" selection).
- `disable(id, version)` marks a specific version disabled in place (fails closed on any resolution attempt, exact or default).
- Both `deprecate()` and `disable()` are manifest-trust-boundary operations — the same trust boundary as `register()` (module-level, called only from trusted in-repo code, never reachable from a request handler since there is no HTTP surface).

## Removed capabilities fail closed

There is no "remove" operation. A capability that should no longer exist is `disable()`d, which makes every future `resolve()` call fail closed with `CAPABILITY_DISABLED` — this is safer than actually removing the Map entry, since it produces a clear, auditable, permanent signal rather than a bare "not found" that could be confused with a typo.
