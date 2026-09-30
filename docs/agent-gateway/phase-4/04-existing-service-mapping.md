# Phase 4 — Existing Service Mapping (Step 0 Audit Results)

Full trace of every Phase 3 capability's real backend implementation, performed before any Phase 4 code was written, per the mandatory Step 0 audit requirement.

## products.list -> `app/api/products/route.ts` GET (lines 7-73)

- **Query**: `db.product.findMany({ where: { status: "AVAILABLE", ... }, orderBy, skip, take, include: { tiers: {...} } })`.
- **Auth**: none — public route.
- **Validation**: manual only (no zod). No schema validation of `type` against the `ProductType` enum.
- **Contract mismatch found**: the real route always forces `status: "AVAILABLE"` (no way to list other statuses) and has NO `category` filter at all (filters by `type`, not `category`) — but Phase 3's `manifest.ts` declares `{status?, category?, limit?}` as valid input. **Resolution**: `ProductsListAdapter` rejects any non-`"AVAILABLE"` `status` and any `category` input with `INVALID_INPUT`, rather than silently ignoring them or (worse) implementing a `category` filter the real service never had. This is a real, disclosed gap between the Phase 3 contract and Phase 4's implementation — not swept under the rug.
- **Limit cap**: real route caps at 50; manifest declares max 100. Adapter honors the tighter existing cap of 50.
- **Sensitive fields excluded**: `deliveryConfig` (AES-256-GCM-encrypted secrets, per the schema's own in-file comment), `commerceConfig`, `aiConfig`, `embedding` (pgvector), `assignedUserId`/`assignedEmail`/`reservedUntil`, `lockedBy`/`lockedAt`/`createdBy`/`lastEditedBy`/`version` — the adapter's Prisma `select` includes only `{ id, name, slug, status, type }`, matching the manifest's `productSummarySchema` exactly.

## products.get -> `app/api/products/[slug]/route.ts` GET (lines 6-38)

- **Query**: `db.product.findUnique({ where: { slug }, include: { tiers, reviews } })`, 404 JSON on null.
- **Side effect found**: a fire-and-forget `db.product.update({ data: { viewCount: { increment: 1 } } })` on every successful lookup.
- **Contract translation**: the capability's declared input is `{ id }`, not `{ slug }` — same `Product` model, different lookup key. `ProductsGetAdapter` queries by `id`.
- **Side effect intentionally NOT replicated**: the capability's own Phase 3 metadata declares `sideEffects.effects: []` and `operationType: "READ"` — incrementing a public view counter from an AI-driven read would violate the capability's own contract, so the adapter omits it. Verified by test (`products-get-adapter.test.ts`: "does NOT increment viewCount").

## subscriptions.get -> no dedicated route exists

- There is **no** `GET /api/subscriptions/[id]` route anywhere in the codebase. The closest existing pattern is the ownership-check-then-fetch logic duplicated inline across `app/api/subscriptions/[id]/{cancel,pause,resume,upgrade,downgrade}/route.ts` (5 near-identical copies).
- **Inconsistency found**: `cancel`/`resume` return 404 for BOTH "not found" and "not owned" (never leaking existence to a non-owner); `pause` returns a distinguishing 403 with an admin bypass.
- **Resolution**: `SubscriptionsGetAdapter` replicates the SAME ownership-check-then-fetch shape (not new business logic — the pattern already exists, just duplicated 5 times, not extracted into a shared function anywhere in the codebase), and standardizes on the tighter 404-for-both behavior, using `context.ownerId` (the trusted Phase 2 identity) for the ownership comparison — never `auth()`/`requireAdmin()`, since those depend on a real Clerk human session and would simply return `null` for a machine caller (confirmed: `lib/auth.ts`'s `auth()` calls `currentUser()` from `@clerk/nextjs/server`, which has nothing to authenticate for an AI agent request).
- **Sensitive fields excluded**: `stripeSubId`, `razorpaySubId` (raw payment-gateway subscription identifiers), `metadata` (an unvetted internal `Json?` bag) — none of the existing routes reading this model apply this exclusion themselves; the adapter's explicit `select` is the first place in the codebase this filtering exists for a Subscription read.

## tickets.list -> `app/api/tickets/route.ts` GET (lines 8-47)

- **Query**: `db.ticket.findMany({ where: { ...(isAdmin ? {} : {clientId}), status?, priority? }, orderBy, skip, take })`.
- **Admin-sees-all branch found**: non-admin callers are scoped to `clientId: session.user.id`; `SUPER_ADMIN`/`SUB_ADMIN` callers see every ticket, unscoped.
- **Deliberate divergence**: `TicketsListAdapter` **never** takes the admin branch — every execution is unconditionally scoped to `clientId: context.ownerId`, regardless of the owning `User`'s actual role. An AI-facing "list tickets" capability must always mean "this connection's own tickets," never "every ticket in the system."
- **Field excluded**: `assignedTo` (an internal staff `User.id`) — has no meaning to an external AI caller and could be used to enumerate internal staff. The `messages` sub-relation the real route includes only selects `{ id: true }` (no content, no `isInternal` flag) and is already safe by omission — not included in this adapter's output at all.
- **Validation improvement**: the real route casts `status`/`priority` query params directly to their Prisma enum types without validation (an invalid value silently returns zero rows). `TicketsListAdapter` validates `status` against the real `TicketStatus` values explicitly and rejects an invalid value with `INVALID_INPUT` — a clearer contract for a machine caller than a silent empty result.

## products.createDraft -> `createProduct` (`app/(admin)/admin/products/actions.ts`) — NOT_EXECUTABLE_YET

**Real implementation**: a `"use server"` Server Action. Its entire body starts with `const admin = await requireAdmin()` (`lib/admin-auth.ts:23-72`), which:

1. Calls `auth()` -> `currentUser()` (Clerk) — requires a real, live human browser session. A machine/AI request has none.
2. On any authorization failure, calls Next.js's `redirect()` — a special control-flow throw handled by the Next.js framework, not a catchable `Error` a library caller can meaningfully react to outside a real request/render context.
3. Reads `headers()` for `x-nexusai-admin-permission-scope`/`x-nexusai-admin-resource`/`x-nexusai-admin-action` — set by the app's own reverse-proxy in front of admin routes — to enforce the SUB_ADMIN permission matrix (`canUseSubadminPermission`). These headers do not exist outside that specific proxied request path.

**Audit performed**: grepped the entire `lib/` tree for `servicePrincipal|systemActor|machineActor|SYSTEM_USER|delegatedAdmin|actingAs` — zero matches. No service-principal or delegation mechanism exists anywhere in this codebase that a Phase 4 adapter could safely use to construct a `requireAdmin()`-compatible caller.

**Decision**: per the spec's explicit instruction ("Do NOT fake a human admin user unless the existing architecture already has a supported service-principal/delegation mechanism" and "If no safe existing business service exists for a capability, DO NOT create a duplicate implementation automatically... mark the capability as NOT_EXECUTABLE_YET"), this capability has **no adapter**. `AdapterResolver.execute("products.createDraft", ...)` fails closed with `ADAPTER_NOT_FOUND` — verified by test.

## coupons.create -> `createCoupon` (`app/(admin)/admin/coupons/actions.ts`) — NOT_EXECUTABLE_YET

Identical blocker: the exact same `requireAdmin()` dependency, the exact same three failure modes above. Same decision, same justification, same `ADAPTER_NOT_FOUND` outcome, verified by test.

Secondary finding, documented but not blocking-relevant (the capability is already blocked for the reason above): `createCoupon`'s inline parameter type has several fields the Phase 3 manifest schema does not declare (`type` vs. the manifest's `discountType`, `maxUses`/`expiresAt` required-but-nullable vs. the manifest's optional, `applicableTierIds` required array, `isActive` required with no default) — if this capability is ever unblocked in a future phase (e.g. once a service-principal mechanism exists), the adapter would need to synthesize sane defaults for all of these, a meaningful translation task, not a trivial rename.

## products.updatePricing / refunds.process

Both were already correctly modeled as non-executable by Phase 3 (`exposure: INTERNAL_ONLY` and `FORBIDDEN` respectively, `executionReference: null` for both) — no change was needed, and no adapter was built, consistent with Phase 3's own analysis of `updateTier`'s HIGH_RISK_MUTATION status and `processRefund`'s permanent AI_BLOCKED classification (Phase 0's `RISK-MATRIX.md`/`AI-EXPOSURE-CANDIDATES.md`).
