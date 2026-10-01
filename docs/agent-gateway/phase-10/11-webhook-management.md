# Phase 10 — Webhook Management

Webhooks are triggers of type `WEBHOOK` (Phase 9): `POST /api/agent-webhooks/{triggerRef}`, Abhibhi HMAC only, per-trigger secret.

## Secret lifecycle in the UI

- Created with the trigger; the secret and the endpoint path are shown **once** in a dialog with copy buttons and a warning; closing the dialog discards them from the page.
- Rotation (`/rotate-secret`) is confirmed with a reason; the new secret is shown once; the previous one stops verifying immediately (tested: old secret → 401, new → 202).
- The secret is stored encrypted (AES-256-GCM); neither it nor its ciphertext appears in any view, page, audit entry or log (tested across every governance page).

## The webhooks page

Endpoint, status, secret version, deliveries in the last 24 h, last delivery, capability; plus the signing instructions for integrators (canonical message, headers, retry semantics with stable event ids).

## Rejections

Rejected deliveries (bad signature, replay, rate limit) are answered at the edge and are not stored as runs; they are logged as structured `agent_gateway_webhook_rejected` events (reason code only). Accepted deliveries appear as runs with their outcome (task created, denied, approval required, dropped, failed).
