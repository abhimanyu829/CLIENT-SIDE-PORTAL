# 04 — Checkout Verification (Phase 4)

## Signature contract (subscription-specific)

`verifySubscriptionSignature(subscriptionId, paymentId, signature)` computes

```
HMAC-SHA256(`${razorpayPaymentId}|${razorpaySubscriptionId}`, RAZORPAY_KEY_SECRET)
```

and compares with `crypto.timingSafeEqual` (hex, 32 bytes). This is deliberately
DISTINCT from the one-time Order formula (`order_id|payment_id`); reusing the
order formula fails the test (proven in the suite).

## Rules

- Missing/empty/malformed (non-hex) signature → reject.
- Wrong field order → reject.
- A valid signature only CONFIRMS the checkout; it never marks the subscription
  ACTIVE and never grants entitlements. Webhook confirmation is the
  authoritative lifecycle source (browser callback can never be trusted for
  billing state).

## Callback replay

A replayed callback for an already-known subscription is harmless at the billing
layer: no status change happens in the callback path at all.