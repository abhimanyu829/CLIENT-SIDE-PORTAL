# Security — Phase 7

## Controls

- Every API route resolves the customer from the server-side Clerk session
  (`auth()`); user id is never taken from the body or query to establish
  ownership.
- Cancel/pause/resume run through Phase-4 operations whose ownership
  verification uses the session actor id (`SUBSCRIPTION_NOT_OWNED` otherwise).
- `confirm-checkout` loads the subscription scoped to the session user before
  verifying the signature; unknown → 404.
- Plan catalog: only PUBLISHED plans/versions are surfaced
  (`listPlan` filter + version-status check); draft/archived never shown as
  purchasable (tested).
- Trial eligibility: server-computed only; the UI renders the server result.
- Pricing/limits: server-derived from plan records; client cannot override.
- Activation: never produced by the browser — confirmed only via verified
  webhooks (Phase 4); the callback only verifies signature and reports pending.
- No secrets in responses (public key id only); no provider/webhook secret
  exposure; no privileged admin endpoints in customer routes.
- Cross-customer cache/data isolation: overview queries are userId-scoped; no
  shared cached payloads introduced.

## Residual risks

- Provider-pending state relies on webhook delivery; UI shows pending (per
  Phase-4 contract).
- Trial conversion requires explicit paid checkout + verified paid grant
  (Phase 6 `confirmTrialConversion` not exposed to the UI; conversion is driven
  by the paid lifecycle).