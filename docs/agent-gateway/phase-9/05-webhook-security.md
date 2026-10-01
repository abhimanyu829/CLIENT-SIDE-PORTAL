# Phase 9 — Webhook Security

## Signature

```
message = join("\n", [
  "abhibhi.webhook.v1",
  x-abhibhi-timestamp,
  x-abhibhi-nonce,
  x-abhibhi-event-id,
  METHOD,                       // "POST"
  "/api/agent-webhooks/<triggerRef>",
  hex(sha256(raw body bytes as UTF-8))
])
x-abhibhi-signature = hex(HMAC-SHA256(trigger secret, message))
```

- The path is the canonical path computed from the trigger ref, not the request URL (proxies cannot change what is verified).
- Unlike the Phase 1 request signature, the nonce and the event id are inside the signed message: neither can be swapped on a captured request.
- Comparison is constant-time (`shared/crypto.ts constantTimeEqual`); only 64-hex signatures are considered.
- Reused primitives: `hmacSha256Hex`, `sha256Hex`, the `x-abhibhi-*` header family, `lib/encryption.ts` for the secret at rest (AES-256-GCM, exactly how Phase 2 stores signing secrets).

## Threats and controls

| Threat | Control | Test |
|---|---|---|
| forged delivery | HMAC with a per-trigger 256-bit secret | wrong secret -> 401 |
| tampered body / path / method / event id / timestamp / nonce | all bound in the message | each part -> 401 |
| replay of a captured request | single-use nonce (Redis SET NX EX), checked after the signature | same nonce -> 409 |
| old captured request | timestamp within ±`AGENT_GATEWAY_MAX_CLOCK_SKEW_SECONDS` (300 s); nonce TTL (600 s) exceeds it | ±301 s -> 401, 300 s accepted |
| nonce burning by an attacker | nonce consumed only after a valid signature | forged request, then the sender's request with the same nonce -> 202 |
| Redis outage used to bypass controls | nonce store and rate limiter fail closed | 503, nothing recorded |
| flooding | size cap (streamed), content type, per-ref rate limit before any database work | 413 / 415 / 429 |
| probing for triggers | unknown, paused, non-webhook and malformed refs all return the same 404 body | identical bodies |
| body choosing what runs | only `resourceId` is read, pattern-validated | hostile body -> stored config used |
| secret disclosure | shown once; encrypted at rest; never in views, logs or responses | view/log/response scans |
| secret compromise | rotation invalidates the old secret immediately | old secret -> 401 |
| body stored in the platform | only `sha256(body)` is kept | run/task scans |

## Not an authentication bypass

The webhook authenticates the **sender**, not the agent. It can only ask for the stored operation to be attempted; the task is then authorized against live Phase 6 policy and Phase 7 autonomy/approval for the trigger's connection. A valid webhook for a revoked connection or a denied capability creates nothing.
