# Phase 0 — Security Baseline

## HTTP / Transport
- TLS terminated at nginx (`TLSv1.2/1.3`, `HIGH:!aNULL:!MD5` ciphers).
- HSTS present both at Next.js (`max-age=63072000; includeSubDomains; preload`) and nginx (shorter max-age, no preload) — redundant, not conflicting.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restricting camera/mic/geolocation/payment — all present and correctly configured (`next.config.js`).

## Content Security Policy — gaps found
- `connect-src *` (next.config.js) is wide open — undermines CSP's exfiltration protection for `fetch`/`XHR`/`WebSocket` to arbitrary origins. Worth tightening to an explicit allowlist (Clerk, Stripe/Razorpay, Pusher, Sentry, R2) before any AI-adjacent surface increases the attack surface further.
- `script-src` includes `'unsafe-eval' 'unsafe-inline'` — likely required by a third-party SDK, but weakens XSS mitigation.

## CORS
- **No `Access-Control-*` headers configured anywhere** (next.config.js, proxy.ts, or any route.ts). The app relies entirely on same-origin browser defaults with no explicit cross-origin policy, and implements no OPTIONS/preflight handling. This is neutral for the current human-facing app but directly relevant to Phase 1: a remote MCP client is by definition a cross-origin caller — the Agent Gateway's own CORS/OPTIONS handling must be built fresh, not inherited from this app.

## Rate limiting
- **nginx layer:** `api_general` 100r/m, `api_checkout` 10r/m, `api_auth` 5r/15m, `api_coupon` 20r/h. **Stripe/Razorpay webhook paths have no nginx rate-limit zone** — a code comment claims "Stripe IPs only" but no actual `allow`/`deny` directive backs it; protection there is signature-verification-only.
- **Application layer (`proxy.ts`, Upstash):** general 2000/15min, payment 20/60s, refund 3/60min, keyed by `user:{clerkId}` if authenticated else `ip:{address}`. IP is derived from `x-real-ip`/`x-forwarded-for`, trusted as-is — spoofable if the app is ever reachable bypassing nginx. Rate limiting is **fully disabled** if Redis is unconfigured, and skipped in dev/loopback.

## Webhook signature verification
| Service | Mechanism | Assessment |
|---|---|---|
| Stripe | SDK `constructEvent()` | Correct |
| Razorpay | HMAC-SHA256 + `crypto.timingSafeEqual` | Correct |
| Clerk | Svix HMAC (library-managed, incl. built-in timestamp tolerance) | Correct |
| Resend | Static string equality against a shared secret header | **Weak — not cryptographic, not constant-time** |
| Paytm / PhonePe | None | Currently harmless (inert stubs, no mutation) but must gain real verification before any real logic is added |

## Replay protection
**Confirmed: no first-party nonce or timestamp-based replay protection exists anywhere in `lib/` or `app/api/`.** The only replay-adjacent protection in the entire application is Svix's built-in timestamp tolerance for Clerk webhooks — third-party, not app-authored. All other idempotency is DB-state-based (unique constraints, status guards), which prevents duplicate *processing* but does not prevent an attacker from replaying a captured, still-valid signed request within its validity window.

**This is directly relevant to Phase 1:** the architecture spec's mandated nonce+timestamp replay protection for signed agent requests (Section 5) is not something this codebase already does elsewhere and can reuse — it must be built new, with no existing first-party pattern to follow.

## Error handling / information leakage
- No stack traces are ever returned to clients (confirmed across sampled routes) — good.
- **Many routes forward raw `error.message` to the client** via the pattern `error instanceof Error ? error.message : "..."` (e.g. `custom-service-requests/[id]/messages`, `payments/razorpay/order`, `admin/payments/[id]`, `health`, `payments/test`). A minority of routes correctly whitelist to a fixed sentinel string (e.g. `"Forbidden"`) instead — this is the safer pattern and should be the standard for any future agent-facing error surface, since an AI-readable error message is effectively public documentation of internal failure modes if not curated.

## Secrets / encryption
- `lib/encryption.ts`: AES-256-GCM confirmed, random 12-byte IV, `iv:authTag:ciphertext` format, auth-tag verified before decrypt (tamper-evident), fails closed in production if `ENCRYPTION_KEY` unset.
- No service-role keys, DB admin credentials, or gateway secret keys found hardcoded anywhere in `lib/` or `app/` — all secrets are environment-variable-sourced as expected.

## CSRF
- No custom CSRF token scheme exists in any route handler.
- Next.js Server Actions' built-in Origin-header CSRF protection is confirmed **not disabled** (no `experimental.serverActions.allowedOrigins` override found) — intact for the Server Action surface.
- Plain Route Handlers rely on auth + same-origin browser behavior only, with no explicit anti-CSRF token — acceptable for the current same-origin web app, not directly relevant to the Agent Gateway (which authenticates via bearer token/signature, not cookies, so CSRF in the traditional sense does not apply to it — but this is worth stating explicitly in Phase 1 design so the gateway doesn't accidentally rely on cookie-based session trust).

## Testing / build-gate posture
- **Zero automated tests exist** (no jest/vitest/playwright, no test files, no `__tests__` directories) — confirmed via package.json and full-repo search.
- `next.config.js`: `typescript.ignoreBuildErrors: true` — production builds ship even with type errors present.
- `.eslintrc.json` extends only `next/core-web-vitals` with no additional rules — no security-focused linting (no `no-eval`, no object-injection detection) exists at all.

## Summary of what the Agent Gateway can safely reuse vs. must build fresh

| Reusable as-is | Must be built fresh for the gateway |
|---|---|
| TLS/nginx layer | CORS/OPTIONS handling for MCP clients |
| HSTS/security headers pattern | Nonce/timestamp replay protection |
| AES-256-GCM encryption utility (`lib/encryption.ts`) | Rate-limiting keyed by `connectionId` (current keys are user/IP only) |
| Stripe/Razorpay-style HMAC verification pattern (as a model, not the code itself) | A curated, redacted error-response contract for tool-call failures |
| `WebhookEvent`-style idempotency-by-unique-key pattern (as a model) | Actual gateway-side idempotency-key + request-hash enforcement (nothing generic exists to reuse) |
