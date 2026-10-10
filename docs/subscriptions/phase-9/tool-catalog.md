# Tool Catalog — Phase 9

## READ (Class 1 — no approval; owner-scoped context required)

| Tool | Input | Output | Backing service |
|---|---|---|---|
| `subscriptions.plansList` | `{}` | published plans (id, name, type, currency, price, interval, versionId, items[]) | `listCustomerPlans` (Phase 7/2) |
| `subscriptions.summary` | `{}` | paid subs, trials, freeForeverActive, accessKeys | `getCustomerSubscriptionOverview` (Phase 7) |
| `subscriptions.accessExplain` | `{}` | accessKeys, storageLimit, adminLimit | Phase-3 resolver |
| `subscriptions.trialStatus` | `{}` | trials (id, planName, status, startedAt, expiresAt authoritative), freeForeverActive | Phase-7 view |
| `subscriptions.billingHistory` | `{}` | recent charges/invoices/payments (owner-scoped) | Phase-7 view |

## HIGH_RISK_MUTATION (Class 3 — mandatory human approval)

| Tool | Input | Output | Backing service |
|---|---|---|---|
| `subscriptions.freeEnroll` | `{}` | enrollmentId, existing | `enrollFreePlan(ownerId)` (Phase 6) |
| `subscriptions.trialStart` | `{ planId }` | enrollmentId, planVersionId, status, startsAt, expiresAt | `startTrial({userId: ownerId, planId})` (Phase 6) |
| `subscriptions.cancelRequest` | `{ subscriptionId, cancelAtCycleEnd? }` | status | `cancelRecurringSubscription(ownerId…)` (Phase 4, customer path) |

## Contract rules (enforced)

- `.strict()` zod schemas — unknown/privileged fields rejected (e.g. `userId`,
  `confirmed`, `price`).
- Resource locators checked for ownership (`assertOwnerSubscription`) both at
  approval preflight and immediately before execution (stale-approval defense).
- Domain errors normalized to the published error contract
  (`RESOURCE_NOT_FOUND`, `CONFLICT`, `INVALID_INPUT`).
- Outputs validated against the capability output schema; provider ids,
  secrets, metadata bags never returned.
- Mutation idempotency delegated to the underlying services
  (dedupe keys / terminal-state handling).

## Not exposed

Paid checkout initiation, plan publication, entitlement grant/revoke, refunds,
any `{ byAdmin }` path, unrestricted queries.