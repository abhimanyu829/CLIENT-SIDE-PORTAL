# Phase 13 — 03 Marketing

| Operation | Readiness | Capability |
|---|---|---|
| read the active campaign | READY | `campaigns.getActive` |
| create a coupon | NOT_READY | `coupons.create` (described, no adapter) |
| create / edit / activate a campaign | NOT_READY | — |
| send e-mail campaigns | NOT_READY | — |

## campaigns.getActive

- Input: `{}` (strict).
- Query: identical to the public `GET /api/campaigns/active`: `isActive`, `startsAt <= now <= endsAt`, highest `discountPercent` first.
- Output: `{ campaign: null | { id, name, label, type, discountPercent, bannerText, startsAt, endsAt, applicableTierIds (≤ 50), secondsRemaining } }` — the public endpoint's field set.
- Never returned (also excluded by the public route): impressions, clicks, conversions, revenue, A/B variants, CTA URLs, targeting, creator.
- Identity: connection only (public data); still gated by Phase 6 / 7 like every capability.
- Trust: `THIRD_PARTY_CONTENT` (admin-authored banner text is still text an agent must not obey).

## Why marketing writes stay NOT_READY

Coupons: the existing `createCoupon` action requires an admin session and no RBAC permission covers coupons (Phase 3 gap). Campaigns: admin-only route, and a discount affects revenue for every customer. E-mail campaigns: bulk outbound messaging with no per-recipient consent check on an agent path.

## Proof

`p13-domains` C: the running campaign wins over a bigger inactive one and an expired one; revenue, CTA URL and creator never appear; the third-party content notice is attached; `null` when nothing runs; arguments refused.
