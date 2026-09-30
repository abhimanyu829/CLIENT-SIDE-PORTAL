# Phase 4 — Input/Output Contracts

For each of the 4 executable capabilities, this documents the exact translation between the Phase 3 capability schema (what an AI caller supplies/receives) and the real existing service's shape.

## products.list

**Input** (Phase 3 `inputSchema`): `{ status?: string, category?: string, limit?: number }` (all optional, `.strict()`).
**Adapter translation**:
- `status`: rejected with `INVALID_INPUT` unless `undefined` or exactly `"AVAILABLE"` (the real service's only supported value).
- `category`: rejected with `INVALID_INPUT` if present at all (no real backing filter exists).
- `limit`: `Math.min(input.limit ?? 12, 50)` — the real service's own cap of 50, tighter than the manifest's declared max of 100.
**Real service call**: `db.product.findMany({ where: { status: "AVAILABLE" }, orderBy: { createdAt: "desc" }, take: limit, select: {...} })`.
**Output** (Phase 3 `outputSchema`): `{ items: { id, name, slug, status, type }[] }` — the adapter's Prisma `select` matches this exactly, nothing more.

## products.get

**Input**: `{ id: string (1-64 chars) }`.
**Adapter translation**: none needed beyond using `id` as the Prisma lookup key (the real route uses `slug`; same model, different key, per capability contract).
**Real service call**: `db.product.findUnique({ where: { id }, select: {...} })`.
**Output**: `{ id, name, slug, status, type }` (the manifest's `productSummarySchema`) — no `tiers`, no `reviews`, no `deliveryConfig`/`commerceConfig`/`aiConfig`/`embedding`/PII fields.
**Error translation**: `null` result -> `ExecutionError("RESOURCE_NOT_FOUND", ...)`, mirroring the real route's explicit 404.

## subscriptions.get

**Input**: `{ subscriptionId: string (1-64 chars) }`.
**Adapter translation**: ownership check against `context.ownerId` (trusted Phase 2 identity), not any request-body field.
**Real service call**: `db.subscription.findUnique({ where: { id }, select: { id, userId, status, tierId } })`.
**Output**: `{ id, status, planId }` — `planId` is the adapter's own naming for `tierId`, matching the manifest's declared output shape (`manifest.ts`'s `subscriptionsGet.outputSchema`).
**Error translation**: both "not found" and "found but not owned" -> the identical `RESOURCE_NOT_FOUND`, never distinguishable to the caller.

## tickets.list

**Input**: `{ status?: string, limit?: number }`.
**Adapter translation**:
- `status`: validated against the real `TicketStatus` enum values explicitly (`OPEN`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`) — rejected with `INVALID_INPUT` if not one of these, rather than the real route's silent zero-rows-on-bad-enum behavior.
- `limit`: `Math.min(input.limit ?? 20, 50)` — the real service's own cap.
- `clientId`: unconditionally `context.ownerId` — never derived from any request input, never the real route's admin-sees-all branch.
**Real service call**: `db.ticket.findMany({ where: { clientId, status? }, orderBy: { updatedAt: "desc" }, take: limit, select: { id, title, status } })`.
**Output**: `{ items: { id, subject, status }[] }` — `subject` is the adapter's own naming for the real model's `title` field, matching the manifest's declared output shape. `assignedTo` is never selected at all.

## General rule applied everywhere

Every adapter's Prisma `select` is an explicit allowlist that maps 1:1 onto the capability's own `outputSchema` fields — never a bare `include: { ... }` or an unfiltered row spread. The resolver additionally re-validates the adapter's returned `output` against the same `outputSchema` before returning it to the caller (see `01-execution-architecture.md`'s flow diagram, step 7) — a defense-in-depth check that catches any adapter/schema drift even if an adapter's own `select` were ever edited incorrectly in the future.
