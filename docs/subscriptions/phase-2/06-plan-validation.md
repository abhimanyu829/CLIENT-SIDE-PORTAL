# 06 — Plan Validation (Phase 2)

## Two layers

1. **Input validation** — strict zod schemas (`createPlanSchema`,
   `updatePlanHeaderSchema`, `createVersionSchema`, `updateVersionSchema`,
   `addPlanItemSchema`). Unknown keys rejected (no `status`, no owner/team, no
   provider ids, no arbitrary object injection).
2. **Publish validation** — `validatePlan(planId, versionId?)` returns a
   deterministic issue list. Publishing fails closed when any issue exists.

## Header checks (`validatePlanHeader`)

- name ≥ 2 chars; slug matches `^[a-z0-9]+(-[a-z0-9]+)*$` (3-80).
- `planType` required and controlled.
- `currency` in the controlled set.
- `price` non-negative; paid plans require positive price (except CUSTOM/ENTERPRISE).
- FREE plans require exactly zero price.
- `durationMonths` non-negative.

## Composition checks (`validateVersionComposition`)

- paid version requires a positive price and **at least one item**.
- FREE plans may publish with zero items.
- version price/interval/duration non-negative.
- no duplicate `(itemType, itemRefKey)` items.
- singleton limit types (`STORAGE`/`USER_LIMIT`/`ADMIN_LIMIT`/`RESOURCE_LIMIT`)
  require a non-negative `limitValue`.
- the version being published must be `DRAFT`.

## When validated

- `validatePlan()` is callable on demand (returns `{ valid, issues }`).
- `publishPlan()` calls it and throws `PlanValidationError` (with issues) if
  invalid — the plan/version stays DRAFT.

## Referential integrity at add time

`addPlanItem` verifies referenced resources exist (Product/ServicePage/AIAgent) and
refuses wrong-type or stray references. Duplicates are refused with friendly
messages and backstopped by the DB unique index.
