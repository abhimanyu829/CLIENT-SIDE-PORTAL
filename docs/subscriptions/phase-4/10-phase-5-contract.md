# 10 — Phase 5 Contract (Phase 4)

Phase 4 emits internal events ONLY; Phase 5 will consume them to provision
entitlement grants (Phase 3 engine). No provisioning happens here.

## Emitted events (existing event-bus, new keys added)

- `SUBSCRIPTION_ACTIVATED` — subscription became billable/active
- `SUBSCRIPTION_HALTED` — payment failure escalated (PAST_DUE)
- `SUBSCRIPTION_CHARGE_SUCCEEDED` / `SUBSCRIPTION_CHARGE_FAILED` — per charge
  (`{ subscriptionId, razorpayPaymentId, amountSubunits }`)
- `SUBSCRIPTION_PAUSED` / `SUBSCRIPTION_REACTIVATED` / `SUBSCRIPTION_CANCELLED`
- `SUBSCRIPTION_STATE_CHANGED` — generic lifecycle hook

Payloads include `subscriptionId` (UserSubscription id) and provider refs.

## Phase-5 actions these events enable (NOT in Phase 4)

- activated/charged → grant entitlements per `PlanVersion` items
  (`describePlanItemEntitlement`, Phase 3)
- halted/cancelled/expired → suspend/revoke subscription-sourced grants while
  STANDALONE grants stay (source separation, Phase 3)
- renewed charge → extend the entitlement window

## Guarantee for Phase 5

Every lifecycle truth is durable: subscription state, webhook invoice,
charge records, provider refs. Phase-5 consumers need no extra provider calls
for the common paths, only the event payloads + `UserSubscription` records.