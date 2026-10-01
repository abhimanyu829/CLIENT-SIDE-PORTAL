# Phase 13 — 06 Analytics

| Operation | Readiness | Capability |
|---|---|---|
| my account summary | READY | `analytics.summary` |
| my product performance | READY | `analytics.productPerformance` |
| platform-wide analytics / revenue | NOT_READY | — |

## analytics.summary

- Input: `{}`. Output: `{ subscriptions: { active, total }, tickets: { open, total }, products: { published, total } | null }`.
- The same KPIs as the admin analytics route (active subscriptions, open = OPEN + IN_PROGRESS tickets, published = AVAILABLE products), restricted to the owner. `products` is `null` for a caller without a vendor profile.
- Counts only; `SYSTEM_GENERATED`; permission `read:analytics`.

## analytics.productPerformance

- Input: `{ productId, days?: 7 | 30 | 90 }` (the existing route's windows; default 30).
- Ownership: the product's vendor profile must belong to the owner; another vendor's product, a vendor-less product and a missing one produce the identical `RESOURCE_NOT_FOUND`.
- Output: `{ productId, days, views, cartAdds, checkoutsStarted, purchases, conversionRate (purchases / views, 4 decimals, null without views), averageRating, reviewCount }` from `PlatformMetricEvent` (VIEW, CART_ADD, CHECKOUT_STARTED, PURCHASE) inside the window.
- Never returned: buyer user ids, sessions, order ids, revenue, event metadata.

## Why platform analytics stay NOT_READY

They are admin-only today and are aggregates across all tenants (users, revenue). No agent connection acts for the platform, so there is no owner to scope them to.

## Proof

`p13-domains` F: summary counts only the owner's rows and returns `null` products for a non-vendor; funnel counts inside the window (an event at 45 days counts only for `days: 90`), conversion rate, no buyer id; unsupported windows refused; the three not-owned cases are indistinguishable.
