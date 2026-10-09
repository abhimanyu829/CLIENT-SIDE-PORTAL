# 05 — Webhook Security (Phase 4)

## Endpoint

`POST /api/webhooks/razorpay/subscriptions` — dedicated to recurring events.
The existing one-time webhook route (`/api/payments/razorpay/webhook`) is
untouched.

## Verification

1. Raw body read as text (never re-parsed for verification).
2. `x-razorpay-signature` header validated: 64 hex chars.
3. Expected = HMAC-SHA256(rawBody, secret), constant-time compare.
4. Secret: `RAZORPAY_SUBSCRIPTIONS_WEBHOOK_SECRET` (falls back to
   `RAZORPAY_WEBHOOK_SECRET`), server-side only via `lib/env`.
5. Unconfigured secret → HTTP 503 (fail closed); invalid signature → HTTP 400;
   processing failure before durable acceptance → HTTP 500 (provider retries).

## Durable inbox (reuse)

`WebhookEvent` (`source = RAZORPAY`, `eventId @unique`) is the dedupe key.
Payload stored minimized (event type, subscription id, status, payment id),
never full provider blobs with secrets.

## Unknown subscriptions

Events for internal records we do not know are durably accepted as processed
with no mutation and a warn log — no fabricated records.

## Replay / tamper

Replayed event id → idempotent duplicate (200). Tampered body after signing →
signature mismatch → 400 before any persistence. No unsigned event is ever
processed.