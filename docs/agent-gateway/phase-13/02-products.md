# Phase 13 — 02 Products

| Operation | Readiness | Capability |
|---|---|---|
| browse the published catalogue | READY (Phase 4) | `products.list` |
| read one published product | READY (Phase 4, published only since Phase 12) | `products.get` |
| list my vendor products | READY (Phase 13) | `products.listMine` |
| create a product draft | NOT_READY | `products.createDraft` (described, no adapter) |
| change pricing | NOT_READY | `products.updatePricing` (INTERNAL_ONLY) |
| publish / archive / delete | NOT_READY | — |

## products.listMine

- Input: `{ status?: ProductStatus, limit?: 1..50 }` (strict; status is the Prisma enum).
- Ownership: vendor profiles with `userId = context.ownerId` (at most 10), then products with `vendorId in` those profiles. A caller without a vendor profile gets `{ items: [] }`.
- Output: `{ items: [{ id, name, slug, status, type }] }`, at most 50; drafts included (they are the caller's own).
- Never returned: delivery configuration (encrypted credentials), access URLs, pricing internals, embedding, vendor ids.
- Trust: `THIRD_PARTY_CONTENT` (names are user-authored).

## Why product writes stay NOT_READY

The existing product service is admin-moderated: create, version, lock and publish run behind `requireAdmin()` with a Clerk session, and there is no vendor-scoped service path. Building one would be a new business workflow, not an adapter. Pricing changes are a HIGH_RISK_MUTATION with direct revenue impact and remain INTERNAL_ONLY by the Phase 3 decision.

## Proof

`p13-domains` B: owner-only listing with drafts, nothing beyond the summary (a seeded `deliveryConfig` secret never appears), other owner sees only theirs, status filter, non-vendor empty list, schema refusals before the gate (no adapter call, no approval).
