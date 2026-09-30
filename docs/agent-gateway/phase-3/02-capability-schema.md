# Phase 3 — Capability Schema

The full `CapabilityDefinition` shape (`lib/agent-gateway/capabilities/types.ts`), grouped by concern. All fields are immutable once registered (see `07-security-boundary.md`).

## Identity fields

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `domain.action`, e.g. `products.list`. Business intent, never table/implementation terminology. No version suffix here. |
| `version` | `number` | Integer >= 1. Small, reliable model — not semver. |
| `domain` | `string` | The business domain (`products`, `subscriptions`, `tickets`, ...). |
| `name` | `string` | Human-readable label. |
| `description` | `string` | Human-readable explanation, including risk rationale where relevant. |

## Lifecycle / discovery fields

| Field | Type | Notes |
|---|---|---|
| `status` | `"ACTIVE" \| "DEPRECATED" \| "DISABLED"` | Set by `register()`/`deprecate()`/`disable()`. Never set directly by a caller after registration. |
| `operationType` | `RiskTier` | Phase 0's exact 4-tier system (`READ`/`LOW_RISK_WRITE`/`HIGH_RISK_MUTATION`/`CRITICAL`). |
| `exposure` | `ExposureLevel` | See `07-security-boundary.md`. Independent of `status` — a capability can be `ACTIVE` and still `FORBIDDEN`. |

## Contract fields

| Field | Type | Notes |
|---|---|---|
| `inputSchema` | `z.ZodType \| null` | Required for every non-`FORBIDDEN`, non-`DISABLED` capability. Every registered schema is `.strict()` — unknown fields are rejected. |
| `outputSchema` | `z.ZodType \| null` | Describes the BUSINESS RESULT, never a raw Prisma row. |
| `errorContract` | `{ code, description }[]` | Stable, capability-specific error codes a future caller should expect. |

## Identity / resource / permission fields

| Field | Type | Notes |
|---|---|---|
| `requiredIdentityContext` | `("connectionId" \| "ownerId" \| "teamId")[]` | Declares which Phase 2 `AgentMachineIdentity` fields a future adapter will need. Verified against the real identity shape by an integration test. |
| `resource` | `{ resourceType, resourceLocator? }` | E.g. `{ resourceType: "Product", resourceLocator: "productId" }`. Consumed by future Phase 6 policy enforcement — not enforced here. |
| `permission` | `{ permission: string \| null, note? }` | A literal from `lib/permissions.ts`, or `null` + an explanatory `note` when no RBAC permission exists yet for that domain. Never an invented permission name. |

## Behavioral metadata (descriptive only — not enforced by this registry)

| Field | Type | Notes |
|---|---|---|
| `sideEffects` | `{ effects: string[], emitsEvents?, triggersRevalidation? }` | Human-readable list; e.g. `"database write (Product, ProductVersion, AuditLog)"`. |
| `idempotency` | `{ requiresIdempotencyKey, idempotencyScope?, retrySafe, duplicateBehavior, class }` | Mirrors Phase 0's `IDEMPOTENCY-MATRIX.md` findings per capability. |
| `async` | `{ executionMode: "SYNC" \| "ASYNC", queue?, worker?, expectedDurationMs?, pollingSupported? }` | |
| `rollback` | `{ reversibility: "REVERSIBLE" \| "IRREVERSIBLE", mechanism }` | Human-readable, e.g. "Delete the draft product." |

## Execution fields

| Field | Type | Notes |
|---|---|---|
| `executionReference` | `{ adapterKey: string } \| null` | A controlled, non-executable string identifier for a FUTURE Phase 4 adapter. Never a function reference, never a dynamic import target. `null` is required for `FORBIDDEN` capabilities. |

## Documentation fields

| Field | Type | Notes |
|---|---|---|
| `documentationUrl` | `string?` | Optional external reference. |
| `securityClassification` | `string?` | Free-text pointer back to Phase 0's `DATA-SENSITIVITY-MATRIX.md` tier — for human review, not machine-enforced. |
| `metadata` | `Record<string,string>?` | Escape hatch for anything not otherwise modeled. Unused in the initial manifest. |
