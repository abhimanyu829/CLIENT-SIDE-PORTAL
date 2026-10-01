# Phase 13 — 04 Subscriptions

| Operation | Readiness | Capability |
|---|---|---|
| read one of my subscriptions | READY (Phase 4) | `subscriptions.get` |
| list my subscriptions | READY (Phase 13) | `subscriptions.list` |
| pause / resume / cancel / upgrade / downgrade | NOT_READY | — |

## subscriptions.list

- Input: `{ status?: SubStatus, limit?: 1..50 }` (strict).
- Ownership: `userId = context.ownerId`, newest first.
- Output: `{ items: [{ id, status, planId, productId, currentPeriodEnd, cancelAtPeriodEnd }] }`.
- Never returned: `stripeSubId`, `razorpaySubId`, `metadata` (the same exclusions as `subscriptions.get`).
- Trust: `SYSTEM_GENERATED` (ids, enums, dates and booleans only).
- Permission: `read:billing`.

## Why subscription changes stay NOT_READY

The existing pause / resume / cancel / upgrade / downgrade routes change billing state at the payment gateways (proration, refunds, schedule changes). They are financial operations: Phase 7 makes any of them approval-mandatory, and Phase 0 BUG-BASELINE #14 (no gateway-side idempotency key) means a retry could double-apply. They become candidates only when the payment layer offers durable idempotency.

## Proof

`p13-domains` D: owner-scoped, newest first, filter, exact output shape, no gateway id, no third-party notice, unknown status refused.
