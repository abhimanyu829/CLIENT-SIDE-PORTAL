# 04 — Plan Lifecycle (Phase 2)

## States

`PlanStatus`: `DRAFT | PUBLISHED | PAUSED | ARCHIVED`

## Transitions (server-controlled)

```
DRAFT     → PUBLISHED | ARCHIVED
PUBLISHED → PAUSED | ARCHIVED
PAUSED    → PUBLISHED | ARCHIVED
ARCHIVED  → (terminal, nothing)
```
Same-state = idempotent no-op.

## Semantics

- `DRAFT` — editable, not offered. Newly created plans start here.
- `PUBLISHED` — offered; has an effective published version (`currentVersionId`).
- `PAUSED` — temporarily not offered; historical definition intact; resumable.
- `ARCHIVED` — terminal. No longer offered for new enrollment. **Nothing is
  deleted** — versions, items, and (future) subscriptions remain. Never un-archived.

## Enforcement

- Pure machine in `plan-lifecycle.ts` (`PLAN_STATUS_TRANSITIONS`,
  `canTransitionPlanStatus`, `assertPlanTransition`).
- Service functions call the guard BEFORE writing; unknown plan → validation error;
  illegal transition → `PlanTransitionError`.
- Version-level machine: `DRAFT → PUBLISHED | ARCHIVED`, `PUBLISHED → ARCHIVED`,
  `ARCHIVED` terminal.
- Status is NEVER taken from a request body (strict zod schemas reject unknown keys
  such as `status`).

## Compare-and-set

`pausePlan` / `resumePlan` / `archivePlan` / `publishPlan` use
`updateMany where { id, status: expectedFrom }`; a lost race yields a typed
transition error instead of a corrupt state.
