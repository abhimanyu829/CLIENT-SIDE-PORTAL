# Phase 1 — Agent Gateway Foundation

Status: IMPLEMENTED. Additive only — no existing file's business logic was changed. See PHASE-1-FINAL-REPORT.md for the full closure report.

## 1. Deployment topology decision

**Chosen: Option B — an isolated module (`lib/agent-gateway/`) mounted via a dedicated Next.js Route Handler (`app/api/agent-gateway/`) inside the existing application**, behind the existing nginx reverse proxy. Not a standalone Node service.

**Why:** Phase 0's audit confirmed this app has no existing pattern of running separate Node services beyond the BullMQ worker process(es) — there is no service mesh, no internal service-to-service RPC, and introducing a second deployable purely for the gateway would mean duplicating TLS termination, environment loading, logging, and Redis/DB connection management that already exist correctly in this codebase. A standalone service would also fail the "smallest architecture that provides isolation" test from the spec — the isolation the gateway needs (its own auth path, its own rate limits, its own error contract) is achieved at the module and route level, not the process level, without giving up horizontal scalability (this route scales exactly like every other Next.js API route already does) or observability (it reuses the existing pino logger).

The existing nginx reverse proxy (`nginx.conf`) is reused as the edge — a new `location /api/agent-gateway/` block was added, not a duplicate proxy layer.

## 2. Trust boundary

```
INTERNET
   │
   ▼
nginx (TLS termination, /api/agent-gateway/ location block, general rate-limit zone)
   │
   ▼
Next.js middleware (proxy.ts) — UNCHANGED, still runs first for /api/:path* per its existing matcher
   │
   ▼
app/api/agent-gateway/route.ts  (POST/GET)
   │
   ▼
lib/agent-gateway/transport/http-boundary.ts — handleGatewayRequest()
   │
   ├─ 1. Gateway-enabled check           → GATEWAY_DISABLED if off
   ├─ 2. Method/content-type/size checks → MALFORMED_REQUEST / REQUEST_TOO_LARGE
   ├─ 3. Authentication (bearer or signed)→ AUTH_* / SIGNATURE_* / REPLAY_DETECTED
   ├─ 4. Request context construction    → identity fields ONLY from verified credential
   ├─ 5. Rate limiting (connectionId)    → RATE_LIMITED
   ├─ 6. Routing to approved destination → NOT_FOUND (Phase 1: nothing registered yet)
   └─ 7. Audit + structured log + response
   │
   ▼
EXISTING BACKEND  (not reached in Phase 1 — no destination is registered)
```

**Note on `proxy.ts`:** the existing middleware's matcher already covers `/api/:path*`, so its general rate limiter and Clerk session resolution still execute for `/api/agent-gateway/*` exactly as for any other API route — this was not bypassed or special-cased. `proxy.ts` was **not modified**. The gateway's own authentication is a **separate, additional trust path** layered on top (per spec §31/§32) — it does not replace, weaken, or interact with Clerk/human session auth in any way.

## 3. Entry point

`POST /api/agent-gateway` and `GET /api/agent-gateway` (both routed through the identical pipeline). `GET /api/agent-gateway/health` is a separate, unauthenticated health/readiness endpoint.

The future MCP mount point (Phase 5) is reserved conceptually at a path under this same prefix (e.g. `/api/agent-gateway/mcp`) — not created in Phase 1.

## 4. Authentication architecture

Two methods, selected by `CompositeAuthenticator` — never both attempted for one request, never a silent fallback from a failed signature check to bearer:

- **Bearer** (`auth/bearer-authenticator.ts`): `Authorization: Bearer <token>` → SHA-256 hash → credential-store lookup. Raw token is never logged, stored, or returned.
- **Signed request** (`auth/signed-request-authenticator.ts`, only attempted when `AGENT_GATEWAY_SIGNING_ENABLED=1` AND signature headers are present): HMAC-SHA256 over `abhibhi.request.v2\ntimestamp\nnonce\nMETHOD\npath\nSHA256(body)`, verified with `crypto.timingSafeEqual`, plus nonce-based replay protection. (Changed after Phase 10: the original v1 message `timestamp\nMETHOD\npath\nSHA256(body)` did not sign the nonce — see §6.)

Both resolve into the same `AuthenticationResult` shape, which feeds `identity/request-identity.ts`'s `buildRequestContext()` — the **only** place identity fields are ever set. Client-supplied identity headers (`X-Agent-Id`, `X-Owner-Id`, `X-Admin`, etc.) are never read anywhere in the auth path.

## 5. Credential storage (Phase 1 — explicitly temporary)

`lib/agent-gateway/auth/credential-store.ts` defines the `CredentialStore` interface (`resolveBearerTokenHash`, `resolveSigningKey`) and one implementation, `EnvCredentialStore`, backed by a JSON array in `AGENT_GATEWAY_CREDENTIALS_JSON`. This is explicitly **not** a production credential-management design — it exists so the gateway pipeline can be built, tested, and exercised end-to-end in Phase 1 without introducing the `AgentConnection` database model (deferred to Phase 2, per the spec's Section 30 database-change rule: "if storage can be deferred to Phase 2 without compromising the gateway foundation, defer it"). Phase 2 replaces `EnvCredentialStore` with a DB-backed implementation of the exact same interface — no caller changes.

Tokens are only ever handled as SHA-256 hashes past the parsing step; signing secrets are read from this same env-JSON and never logged.

## 6. Signature verification & replay protection

- Verification order as specified in the Phase 1 prompt (§13): key exists → timestamp within skew → nonce unused → signature matches → connection active. The nonce is consumed only after the signature passes, so a forged request never burns a real client's nonce.
- Canonical message, version `abhibhi.request.v2` (newline-joined): `abhibhi.request.v2`, the timestamp header, the nonce header, the upper-cased method, the URL pathname (no host, no query string), hex SHA-256 of the raw body. The client signs it with HMAC-SHA256 and its signing secret and sends the hex digest in `X-Abhibhi-Signature`.
- **Fixed after Phase 10 (P2):** the original v1 message (`timestamp`, `METHOD`, `path`, `SHA256(body)`) left the nonce out, so anyone holding a captured request could replay it inside the clock-skew window (300 s) with a fresh nonce. v2 signs the nonce, so swapping it invalidates the signature. There is no v1 fallback, because accepting v1 would allow a downgrade: **every SIGNED_REQUEST client must sign v2.** Signing is opt-in (`AGENT_GATEWAY_SIGNING_ENABLED`, default off). The version line also separates these messages from the Phase 9 webhook messages (`abhibhi.webhook.v1`). The query string stays unsigned; neither agent-authenticated route (`/api/agent-gateway`, `/api/agent-gateway/mcp`) reads it. Tests: `signature-verifier.test.ts`, `signed-request-nonce.test.ts`.
- Replay protection (`auth/replay-protection.ts`) reuses the **existing** Upstash Redis client (`lib/redis.ts`) — no new Redis instance, no new database. Nonce key shape: `agent-gateway:nonce:<keyId>:<nonce>`, atomic `SET NX EX` (single round-trip, no check-then-set race). **Fails closed** if Redis is unavailable — a signed request cannot be authenticated at all if replay protection can't be verified, since this is explicitly a security control per spec §16, not a convenience feature.

## 7. Rate limiting

`limits/rate-limiter.ts` uses `@upstash/ratelimit` against the existing Redis client — the same package `proxy.ts` already depends on. Keyed by `connectionId` once authenticated (`conn:<id>`), by IP only before authentication is resolved (never after, per spec §16). Two independent sliding windows (per-minute, per-hour) — either tripping denies. **Fails closed** when Redis is unavailable, deliberately different from `proxy.ts`'s fail-open behavior, since the gateway is a new, security-sensitive, opt-in surface rather than the general app's rate limiting.

## 8. Request validation

`security/request-validation.ts`: method allowlist (GET/POST only), content-type allowlist (`application/json` for any body-bearing request), a cheap pre-buffer `Content-Length` check, then an authoritative post-buffer byte-length check against `AGENT_GATEWAY_MAX_BODY_BYTES` (default 256KB). JSON parse errors never leak the underlying parser's message.

## 9. Error contract

`shared/errors.ts`'s `GatewayError` is the **only** error type the pipeline is allowed to surface. 15 stable codes (`AUTH_REQUIRED`, `AUTH_INVALID`, `AUTH_EXPIRED`, `CONNECTION_INACTIVE`, `SIGNATURE_INVALID`, `SIGNATURE_EXPIRED`, `REPLAY_DETECTED`, `RATE_LIMITED`, `REQUEST_TOO_LARGE`, `MALFORMED_REQUEST`, `GATEWAY_DISABLED`, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_TIMEOUT`, `INTERNAL_GATEWAY_ERROR`, `NOT_FOUND`), each with a fixed HTTP status. Every response body is `{ success: false, error: { code, message, requestId } }`. `toGatewayError()` is the single funnel any caught value passes through before ever reaching a response — this is what guarantees no stack trace, Prisma error, or secret ever reaches an external caller, tested explicitly in `errors.test.ts`.

## 10. Internal routing boundary

`routing/backend-router.ts`'s `ApprovedDestinationRouter` has **zero registered destinations in Phase 1**. Every request that passes auth+rate-limiting resolves to `NOT_FOUND` — this is correct and intended, not a bug: it proves the "never proxy to an arbitrary destination" boundary exists and rejects-by-default before any capability exists to wire in (Phase 3+). The `route()` method's signature takes only `(context, request)` — there is no destination/URL parameter for any caller, human or AI, to influence.

## 11. Health / readiness

`GET /api/agent-gateway/health` (unauthenticated, by design) returns `{ status, gateway, dependencies: { redis, backend } }` — `"ok" | "unavailable" | "disabled"` only, never a hostname, credential, or connection ID.

## 12. Logging / observability

- Structured logs via the **existing** pino logger (`lib/logger.ts`), scoped `module: "agent-gateway"` — no new logging library.
- `observability/audit-hook.ts`'s `LoggingAuditHook` satisfies the `GatewayAuditHook` interface today by logging; a DB-backed `AgentAuditLog` implementation (Phase 3+, since it's tied to capability/policy concepts that don't exist yet) can replace it later with zero caller changes.
- `observability/metrics.ts` provides 8 in-process counters (no new monitoring platform, since none exists in the host app today — Sentry is error tracking, not a metrics exporter).

## 13. Environment variables (all new, all gateway-scoped, none touching the main app's `lib/env.ts` schema)

| Variable | Default | Purpose |
|---|---|---|
| `AGENT_GATEWAY_ENABLED` | `0` (disabled) | Master switch |
| `AGENT_GATEWAY_HOST` | — | Documentation/health only, never used for auth |
| `AGENT_GATEWAY_MAX_BODY_BYTES` | `262144` | Body size cap |
| `AGENT_GATEWAY_REQUEST_TIMEOUT_MS` | `30000` | Reserved for Phase 3+ upstream-call timeouts |
| `AGENT_GATEWAY_RATE_LIMIT_PER_MINUTE` | `60` | Per-connection/IP limiter |
| `AGENT_GATEWAY_RATE_LIMIT_PER_HOUR` | `1000` | Per-connection/IP limiter |
| `AGENT_GATEWAY_MAX_CLOCK_SKEW_SECONDS` | `300` | Signed-request timestamp tolerance |
| `AGENT_GATEWAY_NONCE_TTL_SECONDS` | `600` | Replay-protection nonce TTL |
| `AGENT_GATEWAY_SIGNING_ENABLED` | `0` | Enables the signed-request authenticator |
| `AGENT_GATEWAY_ENVIRONMENT` | `development` | Informational |
| `AGENT_GATEWAY_CREDENTIALS_JSON` | unset (no credentials) | TEMPORARY Phase 1 bootstrap store — see §5 |

## 14. Known limitations (explicit, not silently accepted)

1. `EnvCredentialStore` is not a production secret-management design — it is a bootstrap for Phase 1 testing/exercising the pipeline. Phase 2 must replace it.
2. No `AgentConnection`, `AgentCapability`, `AgentPolicy`, or `ApprovalRequest` exists. This is intentional Phase 1 scope, not an oversight.
3. `RATE_LIMIT_PER_MINUTE`/`PER_HOUR` are flat, uniform limits — no per-tool, per-team, or budget dimension exists yet (reserved for Phase 3+ per spec §16).
4. The gateway has no OAuth support yet — only Bearer (opaque token) and HMAC signed requests, per spec §11's "future OAuth access tokens" being explicitly deferred.
5. `AGENT_GATEWAY_REQUEST_TIMEOUT_MS` is defined in config but not yet enforced anywhere (there is no upstream call to time out yet, since routing always resolves to NOT_FOUND) — it exists now so Phase 3+'s router integration has the config value ready.

## 15. Phase 2 prerequisites

- Design and migrate the `AgentConnection` Prisma model (per the original architecture spec's schema, adapted to this app's exact `User`/`Team` relation names as confirmed in Phase 0's audit).
- Implement a DB-backed `CredentialStore` and retire `EnvCredentialStore`.
- Decide the real secrets-management mechanism for `credentialRef` (Phase 0's `PHASE-1-READINESS.md` flagged this as an open decision — still open).
- Extend `AgentGatewayRequestContext`'s `policyVersion` field to a real value once `AgentPolicy` exists (Phase 3).
