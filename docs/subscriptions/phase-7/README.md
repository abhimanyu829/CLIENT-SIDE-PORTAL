# README — Phase 7: Customer Subscription Management UI

## Scope

Customer-facing subscription management for the AbhibhiDeveloper dashboard.
Consumes Phases 1–6 services exclusively; adds no payment, entitlement,
provisioning, or billing engine.

## Delivered capabilities

- Subscription overview (paid subscriptions, trials, Free Forever, effective
  access, limits, billing history).
- Published plan catalog + comparison with server-verified pricing/items.
- Free Forever enrollment (Phase 6 service).
- 14-day trial eligibility (server-computed) + activation (Phase 6 service).
- Paid subscription initiation via Phase-4 service + Razorpay Subscriptions
  checkout (subscription_id flow) + signed callback confirmation.
- Self-service cancel (period-end / immediate), pause, resume.
- Customer-scoped billing history (charges/invoices/payments) + link to
  existing Invoices page.

## Dependencies

Phase 1–6 domains (subscription, plan catalog, entitlements, Razorpay billing,
provisioning, free/trial), existing Clerk auth, existing dashboard layout/nav,
existing Razorpay checkout script loader.

## Not included

Phase 8 admin governance, Phase 9 AI governance, Phase 10 reconciliation,
upgrade/downgrade engine (Phase-4 has no plan-switch contract), card management,
refunds. All deferred/documented in `limitations.md`.