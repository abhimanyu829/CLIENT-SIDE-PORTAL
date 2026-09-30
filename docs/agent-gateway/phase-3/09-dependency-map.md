# Phase 3 — Dependency Map

## What the capability registry depends on

| Dependency | Used for | New? |
|---|---|---|
| `zod` | Input/output schema definition and validation | No — existing dependency (`package.json`, used since Phase 1's `config.ts`) |
| `lib/agent-gateway/shared/types.ts`'s `AgentMachineIdentity` | Type reference only, for `requiredIdentityContext` consistency checks in tests | No — Phase 2 type, imported read-only |
| Node's built-in `Object.freeze`/`Object.getOwnPropertyNames` | Immutability enforcement | No — language builtin |

The capability registry has **zero runtime dependency** on Prisma, Redis, the existing business services, or any Phase 1/2 module beyond the type import above. It does not import `lib/db.ts`, does not import any `app/api/**` route, and does not import any existing Server Action. This is intentional — Phase 3 is pure metadata, and its test suite (`lib/agent-gateway/tests/capability-*.test.ts`) requires no mocking of Prisma, Redis, or any external service, unlike Phase 2's tests.

## What depends on the capability registry

Nothing yet. `getCapabilityRegistry()` is exported from `lib/agent-gateway/capabilities/index.ts` but is not imported by any route, any existing business action, or any Phase 1/2 module. This is the correct state for Phase 3 — Phase 4 is what will first import and consume it (to build the adapter map keyed by `executionReference.adapterKey`).

## Manifest -> existing capability trace

Every capability in `manifest.ts` cites its Phase 0 provenance in its own `description`/`securityClassification` fields, and the mapping back to the ACTUAL existing route/service it will one day wrap (per Phase 0's `CAPABILITY-MATRIX.md`) is:

| Capability | Real existing implementation (traced in Phase 0) |
|---|---|
| `products.list` | Prisma reads via `app/api/products/**` |
| `products.get` | Prisma reads via `app/api/products/**` |
| `subscriptions.get` | `GET /api/subscriptions/**` -> Prisma read |
| `tickets.list` | `POST /api/tickets` family of routes |
| `products.createDraft` | `createProduct` — `app/(admin)/admin/products/actions.ts` |
| `coupons.create` | `createCoupon` — coupons `actions.ts` |
| `products.updatePricing` | `createTier`/`updateTier` — `app/(admin)/admin/products/actions.ts` |
| `refunds.process` | `processRefund` — refund-service.ts |

None of these existing files were read-modified in Phase 3 beyond the read-only tracing already done in Phase 0. Phase 4 will be the first phase to actually import from any of them.

## Test dependency map

| Test file | Depends on |
|---|---|
| `capability-id.test.ts` | `capabilities/id.ts` only |
| `dangerous-primitive-guard.test.ts` | `capabilities/dangerous-primitive-guard.ts`, `capabilities/types.ts` (type-only) |
| `capability-schema-validation.test.ts` | `capabilities/schema-validation.ts`, `capabilities/errors.ts`, `zod` |
| `capability-registry.test.ts` | `capabilities/registry.ts`, `capabilities/errors.ts`, `zod` |
| `capability-manifest.test.ts` | `capabilities/registry.ts`, `capabilities/manifest.ts`, `capabilities/index.ts`, `shared/types.ts` (type-only, for the identity-shape integration check) |
| `capability-failure.test.ts` | `capabilities/registry.ts`, `capabilities/errors.ts`, `zod` |
| `capability-security.test.ts` | `capabilities/registry.ts`, `capabilities/errors.ts`, `capabilities/index.ts`, `zod` |

No test file requires mocking `@/lib/db`, `@/lib/audit`, or Redis — a direct consequence of the registry having no such runtime dependency.
