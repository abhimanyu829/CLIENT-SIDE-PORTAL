# Phase 13 — 07 Capability map

Source of truth: `lib/agent-gateway/capabilities/domain-readiness.ts` (`DOMAIN_CAPABILITY_MAP`). `p13-domain-capabilities` proves it against the live registries in both directions: every READY entry is an executable tool, no NOT_READY entry has an adapter or is listed, and every executable capability appears exactly once as READY.

| Domain | Operation | Readiness | Capability | Blocker (NOT_READY) |
|---|---|---|---|---|
| Products | browse the published catalogue | READY | `products.list` | |
| Products | read one published product | READY | `products.get` | |
| Products | list my vendor products | READY | `products.listMine` | |
| Products | create a product draft | NOT_READY | `products.createDraft` | admin-session-only service; no vendor-scoped path |
| Products | change pricing | NOT_READY | `products.updatePricing` | HIGH_RISK, INTERNAL_ONLY |
| Products | publish / archive / delete | NOT_READY | | admin moderation workflow |
| Marketing | read the active campaign | READY | `campaigns.getActive` | |
| Marketing | create a coupon | NOT_READY | `coupons.create` | admin session; no RBAC permission |
| Marketing | create / edit / activate a campaign | NOT_READY | | admin-only; revenue-wide effect |
| Marketing | send e-mail campaigns | NOT_READY | | bulk outbound messaging, no consent check |
| Subscriptions | read one of my subscriptions | READY | `subscriptions.get` | |
| Subscriptions | list my subscriptions | READY | `subscriptions.list` | |
| Subscriptions | pause / resume / cancel / upgrade / downgrade | NOT_READY | | payment-gateway effects; no durable gateway idempotency |
| Support | list my tickets | READY | `tickets.list` | |
| Support | read one of my tickets | READY | `tickets.get` | |
| Support | open a ticket | READY | `tickets.create` | |
| Support | close my ticket | READY | `tickets.close` | |
| Support | reply to a ticket | NOT_READY | | irreversible; external push from the request |
| Support | assign / prioritise / resolve | NOT_READY | | staff-only transitions |
| Analytics | my account summary | READY | `analytics.summary` | |
| Analytics | my product performance | READY | `analytics.productPerformance` | |
| Analytics | platform-wide analytics / revenue | NOT_READY | | cross-tenant aggregates, admin-only |

Agent tool surface after Phase 13 (executable only): 12 capability tools + 3 task tools. Still described but not executable: `products.createDraft`, `coupons.create`; not agent-available: `products.updatePricing` (INTERNAL_ONLY), `refunds.process` (FORBIDDEN).

## Risk profile

| Tier | Executable capabilities |
|---|---|
| READ | 10 |
| LOW_RISK_WRITE | 2 (`tickets.create`, `tickets.close`) |
| HIGH_RISK_MUTATION | 0 |
| CRITICAL | 0 |
