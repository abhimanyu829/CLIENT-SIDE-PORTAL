# Phase 4 — UI Consistency Report

## Principle being verified

"AI mutation -> same backend service -> same event mechanism -> same revalidation -> same existing website/admin UI." No parallel AI-specific UI, no new admin interface, the existing website remains the sole source of truth for displayed state.

## Why this phase has almost nothing to report here, and why that's correct

All 4 registered Phase 4 adapters (`products.list`, `products.get`, `subscriptions.get`, `tickets.list`) are **pure reads**. None of them mutate any data, so none of them have any UI-consistency obligation to preserve — there is no "AI-triggered mutation" for the existing UI to eventually reflect, because no mutation occurs. This is the expected, correct state for this phase, not a gap: Phase 0/3's own risk classification already established that only 4 of the capabilities Phase 3 marked `AGENT_AVAILABLE` are safely executable today (see `04-existing-service-mapping.md`), and all 4 happen to be READ-tier.

## What was still verified, for the two READ adapters that HAVE a real-world UI-consistency-adjacent side effect

- **`products.get`**: the real `app/api/products/[slug]/route.ts` route has a fire-and-forget `viewCount` increment on every successful lookup — a "read that also writes," in effect. `ProductsGetAdapter` deliberately does NOT replicate this (see `04-existing-service-mapping.md`, `08-async-execution.md`), because the capability's own Phase 3 contract declares `sideEffects.effects: []`. Consequence for UI consistency: an AI-driven `products.get` call will never move a product's displayed view count on the storefront — this is the intended, contract-conformant behavior, not a bug, and was explicitly verified by test (`products-get-adapter.test.ts`: "does NOT increment viewCount").
- **`products.list`**: reuses the exact same `where`/`orderBy` shape as the real public catalog route, so an AI-facing listing reflects the identical set of products a human visitor to `/products` would see at the same moment (subject to the same `status: "AVAILABLE"` filter) — there is no divergent "AI view" of the catalog.

## What a future WRITE-capability adapter (e.g. `products.createDraft`, once a service-principal mechanism exists to unblock it per `12-bug-report.md`) would need to preserve, per this phase's audit

The real `createProduct` Server Action (`app/(admin)/admin/products/actions.ts`) already:
1. Writes inside `db.$transaction(...)` (the `Product` row + a `ProductVersion` snapshot + an `AuditLog` entry, atomically).
2. Emits `EVENTS.PRODUCT_CREATED` via the EXISTING event bus (`lib/services/event-bus.ts`).
3. Calls `revalidateProductCaches()` (existing `revalidateTag`/`revalidatePath` calls covering `/admin/products`, `/`, `/products`, `/pricing`, and the type-specific product listing page).

A future adapter for this capability, once unblocked, MUST invoke this exact Server Action (or an equivalently-transactional refactor of it) rather than reimplementing any piece of steps 1-3 itself — this is the direct application of Phase 4's core principle ("preserve existing transactions/events/revalidation, never build a parallel mechanism") to the one capability in this phase's manifest that would actually need it. This is documented here as a requirement for that FUTURE work, not something Phase 4 built.

## Verdict

For the 4 capabilities Phase 4 actually made executable, UI consistency is trivially and correctly preserved: reads never diverge from what a human sees through the existing UI, and the one real side effect a naive implementation might have introduced (the view-count increment) was deliberately excluded per the capability's own declared contract. No new UI, no parallel AI-facing dashboard, no new admin interface was built.
