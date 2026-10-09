# 14 — Phase 4 Exit Checklist

| # | Criterion | Status |
|---|---|---|
| 1 | Paid plans map safely to Razorpay Plans | ✅ 15 mapping tests incl. idempotency/timeout/reconcile |
| 2 | Published plan versions respected | ✅ only PUBLISHED version billable |
| 3 | Billing intervals mapped correctly | ✅ 1/3/6/12 monthly; never silently changed |
| 4 | FREE plans never sent to recurring billing | ✅ rejected + no provider call |
| 5 | Recurring subscriptions created server-side | ✅ createRecurringSubscription (reserve-then-provision) |
| 6 | Customer ownership enforced | ✅ session owner only; cross-tenant refused |
| 7 | Checkout verification uses subscription protocol | ✅ payment_id\|subscription_id HMAC; order formula fails |
| 8 | Subscription webhooks signature-verified | ✅ raw-body HMAC + timingSafeEqual + 503 fail-closed |
| 9 | Duplicate webhooks safe | ✅ WebhookEvent eventId unique, accept-once |
| 10 | Out-of-order webhooks safe | ✅ CAS + transition guards + conflict recording |
| 11 | Lifecycle state maps correctly | ✅ provider→SubscriptionStatus table (07) |
| 12 | Recurring charges recorded idempotently | ✅ payment/event uniques; no Order/invoice pollution |
| 13 | Payment failures represented correctly | ✅ pending/halted → UNPAID/PAST_DUE; no false success |
| 14 | Cancellation works | ✅ immediate + cycle-end, terminal, history kept |
| 15 | Pause/resume works | ✅ provider-truthful, terminal refused |
| 16 | Secrets never reach clients/logs | ✅ server-side env only; suite asserts no leakage paths |
| 17 | No false payment success possible | ✅ ACTIVE requires verified webhook only |
| 18 | No duplicate financial mutation | ✅ three unique axes (mapping/event/charge) |
| 19 | Phase-5 integration contract exists | ✅ events + docs 10 |
| 20 | No entitlement provisioning implemented | ✅ webhook contains no grantEntitlement (tested) |
| 21 | Security tests pass | ✅ Group K (11) |
| 22 | All phase tests pass | ✅ 87/87 razorpay; 95+84+88 prior phases |
| 23 | Standalone regression passes | ✅ zero commerce files touched; structural tests; suites green |
| 24 | Database verification passes | ✅ migrations applied, drift zero, counts intact |
| 25 | Typecheck | ✅ Phase-4 errors 0 (3 pre-existing only) |
| 26 | Lint | ✅ clean |
| 27 | Production build | ✅ PASS 242 pages |
| 28 | Git diff scoped | ✅ below |
| 29 | Protected systems verified | ✅ below |
| 30 | Documentation complete | ✅ 01–14 |

## Git diff scope

New: `lib/services/razorpay-billing.ts`, `razorpay-subscription-webhook.ts`,
route `app/api/webhooks/razorpay/subscriptions/route.ts`, 2 migrations, 8 test
files + fake helper, `vitest.razorpay.config.ts`, docs 01–14. Modified:
`schema.prisma` (+2 models, 2 enums, UserSubscription columns/index,
PlanVersion.back-relation), `lib/env.ts` (+1 opt secret), `event-bus.ts`
(+5 event keys), `package.json` (+test script). No commerce/checkout/one-time
razorpay/PhonePe/Paytm/product/admin/entitlement code changed.

## Protected systems

Standalone purchases, multi-product purchase, cart, checkout, existing
Razorpay one-time flow, payment signature verification, one-time webhook flow,
PhonePe, Paytm, orders, invoices, products, product admin, marketplace — all
UNCHANGED (route/structure tests + zero diff). Phase 1 subscription domain,
Phase 2 plan catalog, Phase 3 entitlement engine — PRESERVED (suites green).

## Manual TEST-MODE checklist (blocked on credentials as of 2026-10-09)

The live round-trip was attempted (`LIVE_RZP=1`, `razorpay-live-db.test.ts`) but
Razorpay rejects the configured TEST keys (`401 Unauthorized`, 3 attempts incl.
direct REST Basic auth). Procedure once a CURRENT TEST pair is set in `.env`:

1. Point Razorpay TEST dashboard subscriptions webhook at
   `/api/webhooks/razorpay/subscriptions` with
   `RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET`.
2. Publish a test plan version → verify `RazorpayPlanMapping` row + plan in
   TEST dashboard.
3. Create a subscription via the service → check UserSubscription reference +
   `sub_…` id in TEST dashboard.
4. Trigger activated/charged/cancelled events from the TEST dashboard →
   verify statuses, SubscriptionCharge rows, duplicate redelivery no-ops.

## Final Phase-4 status

**IMPLEMENTED_WITH_MINOR_FOLLOWUPS** — the single follow-up is the live
TEST-MODE merchant round-trip, blocked on credential acceptance by Razorpay
(`401 Unauthorized` with the current `.env` pair). Re-run
`$env:LIVE_RZP="1"; npm run test:razorpay -- razorpay-live-db` after updating
the keys. Everything else passed and actually ran. No Phase 5-10 code.
