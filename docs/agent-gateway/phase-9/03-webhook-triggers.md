# Phase 9 — Webhook Triggers

`POST /api/agent-webhooks/{triggerRef}` — one endpoint per webhook trigger. `triggerRef` is `trg_` + 128 random bits and is not the database id.

## Request

```
POST /api/agent-webhooks/trg_<32 hex>
Content-Type: application/json
x-abhibhi-timestamp: <unix seconds or ISO-8601>
x-abhibhi-nonce:     <16-128 chars [A-Za-z0-9_-], new for every attempt>
x-abhibhi-event-id:  <1-128 chars [A-Za-z0-9._:-], stable across retries of one event>
x-abhibhi-signature: hex(HMAC-SHA256(secret, canonical message))   see 05-webhook-security.md

{ "resourceId": "prod_123", ...anything else is ignored }
```

Only Abhibhi-format signatures with the trigger's own secret are accepted. There are no third-party verifiers.

## Check order and responses

| Step | Failure |
|---|---|
| feature enabled | 404 `NOT_FOUND` |
| ref format | 404 |
| content type `application/json` | 415 `UNSUPPORTED_MEDIA_TYPE` |
| body size (declared and streamed, default 64 KB) | 413 `PAYLOAD_TOO_LARGE` |
| headers well-formed, timestamp within ±300 s | 401 `SIGNATURE_INVALID` |
| rate limit `agent-webhook:<ref>` (existing limiter) | 429 `RATE_LIMITED` (Retry-After) / 503 when unavailable |
| trigger exists, is WEBHOOK, ACTIVE | 404 (same body as unknown) |
| secret decrypts | 503 `UNAVAILABLE` |
| HMAC | 401 |
| nonce unused (existing Redis nonce store) | 409 `REPLAY_DETECTED` / 503 when Redis is down |
| body is a JSON object | 400 `INVALID_REQUEST` |
| `resourceId` valid (only when the trigger binds it) | 400 |
| fire | 202 `{accepted:true, duplicate:false, runRef}` · 200 `{accepted:true, duplicate:true, runRef}` · 503 retryable |

Every error body is `{ accepted:false, error:<code> }` with `Cache-Control: no-store`. Responses never carry the secret, internal ids, the task, the capability or the authorization outcome: a denied or approval-required run is still `202` (the delivery was accepted and recorded); the outcome is visible to admins on the run.

## What the body can do

Only `resourceId`, and only for a trigger with `bindResource`. The capability, input, owner, connection, environment and adapter always come from the stored trigger. The body is never stored: the run keeps `sha256(body)`.

## Retries

- A duplicate `x-abhibhi-event-id` answers `200 duplicate` with the original `runRef`.
- A transient task-creation failure (queue or task store unavailable) answers `503`; the sender retries with the same event id and a new nonce, and the same run is re-armed and retried with the same task idempotency key, so at most one task exists.

## Secret lifecycle

Generated server-side (`whsec_` + 256 bits), stored encrypted, shown once at creation and at rotation. Rotation invalidates the previous secret immediately (`webhookSecretVersion` increments).
