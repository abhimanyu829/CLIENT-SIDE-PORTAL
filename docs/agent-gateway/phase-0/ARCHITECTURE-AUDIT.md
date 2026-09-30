# Phase 0 — Architecture Audit

Status: READ-ONLY AUDIT. No code, schema, or business behavior was changed to produce this document.

## 1. System Overview

NexusAI / AbhibhiDevelopers is a Next.js 16 (App Router) modular monolith. There is no separate backend service — all business logic lives in Server Actions, Route Handlers, and `lib/services/*.ts`, all backed by a single PostgreSQL database via Prisma.

Deployment topology (confirmed from Dockerfile, Dockerfile.worker, Procfile, docker-compose.yml, package.json):
- **Web** — `next start` (standalone build), port 3000.
- **Worker** — `Dockerfile.worker` runs `jobs/worker.ts` via `tsx`.
- **Alternate worker** — `package.json`'s `workers` script instead runs `lib/workers.ts`.
- **Alternate-alternate worker** — `Procfile`'s `worker:` line runs `jobs/embedding.job.ts`.

**Finding (see BUG-BASELINE.md #1):** these three are not the same file and register different/overlapping BullMQ handlers on shared queue names (particularly `"notifications"`). Which one actually runs in production is not determinable from the repo alone — this must be confirmed operationally before the Agent Gateway assumes any particular worker topology for async side effects (e.g. dunning emails, campaign sync).

- **Reverse proxy** — nginx (`nginx.conf`), TLS-terminating, rate-limiting, in front of the web process.
- **Database** — PostgreSQL (Supabase-hosted per `.env`), with the `pgvector` extension for embeddings.
- **Redis** — Upstash (rate limiting) and/or a self-hosted Redis (BullMQ), both optional at the code level (`lib/queue.ts`'s `createLazyQueue` no-ops silently if `REDIS_URL` unset).

## 2. Request Pipeline (current, human-facing)

```
Browser
  │
  ▼
nginx (TLS, rate-limit zones, security headers)
  │
  ▼
proxy.ts  — Next.js middleware (clerkMiddleware wrapper)
  │  - Upstash rate limiting (general/payment/refund tiers)
  │  - auth-required route redirects (/dashboard, /admin, /checkout, /cart)
  │  - admin permission-header injection (x-nexusai-admin-resource/-action/-permission-scope)
  ▼
Route Handler (app/api/**/route.ts)  OR  Server Action (app/**/actions.ts, "use server")
  │  - requireAdmin() / requireSuperAdmin() / requireRole() / requireApiAuth() / inline auth()
  │  - zod validation (inconsistently applied — see CAPABILITY-MATRIX.md notes)
  ▼
lib/services/*.ts  (business logic)
  │  - Prisma calls, sometimes wrapped in db.$transaction, sometimes not
  ▼
PostgreSQL (via Prisma)
  │
  ├─→ AuditLog (append-only, confirmed no update/delete path anywhere in code)
  ├─→ emitEvent() → Pusher channels (admin-dashboard, private-user-{id}, product-{id}, preview-{id})
  │                → Redis cache invalidation (EVENT_CACHE_INVALIDATION map)
  │                → platform:activity Redis ZSET (public activity ticker)
  └─→ lib/revalidate.ts → revalidateTag/revalidatePath (ISR cache busting)
  ▼
Browser (three reflection mechanisms: Pusher realtime, ISR revalidation, and plain fetch()+setInterval polling — no SWR/React Query anywhere)
```

This is the pipeline the future Agent Gateway must reuse end-to-end. An AI-triggered mutation should enter at the "Route Handler / Server Action" layer (via an adapter) or, in cases with no clean adapter, at the "lib/services" layer directly — never below it.

## 3. Authorization Architecture (current)

Two authentication systems stack on top of each other for admin access:

1. **Clerk** — primary identity provider for all users (`lib/auth.ts`). `authState()` calls Clerk's `currentUser()`, then `syncClerkUserToDatabase()` upserts a local `User` row. `requireRole(allowedRoles)` re-fetches role from DB (zero-trust — never trusts JWT claims).
2. **Subadmin credential session** — a *second*, independent username/password login (`lib/subadmin-workforce.ts`), required in addition to Clerk for any `SUB_ADMIN`-role user to actually use `/admin/*`. Session token is a separate cookie (`nexusai_subadmin_admin_session`), hashed (SHA-256) and stored in `SubadminSession`, versioned via `forceLogoutVersion` for instant revocation.

`requireAdmin()` (`lib/admin-auth.ts`) is the composite gate: Clerk session → DB role/ban re-check → `validateSubadminCredentialSession()` → (for SUB_ADMIN only) `canUseSubadminPermission()` against a 14-resource × 6-action permission matrix (`lib/subadmin-permission-policy.ts`), populated via headers (`x-nexusai-admin-resource`, `x-nexusai-admin-action`) injected upstream by `proxy.ts`. `requireSuperAdmin()` skips the subadmin-credential/permission-matrix layer entirely — SUPER_ADMIN is unconditionally full-access.

A third, legacy system (`Permission`/`UserPermission` tables, checked via `hasPermission()`/`requireServicePermission()`) still exists as a fallback for a handful of "service center" admin pages, coexisting with (not replaced by) the newer subadmin resource/action matrix.

**Full detail:** see AUTHORIZATION-MATRIX.md.

## 4. Data Layer

Prisma schema, ~70 models across 9 domain groups (identity/RBAC, subadmin workforce, catalog/products, commerce, service-engagement, AI, ops/support, CRM/marketing, platform/system). Only `Product` and `ProductTier` carry a `version` field; no model has a `deletedAt` column — soft-delete is modeled via status enums or boolean flags (`isActive`) on a per-model basis, inconsistently.

`AuditLog` is genuinely append-only in practice (confirmed via full-codebase grep: zero `auditLog.update`/`.delete`/`.upsert` calls exist). `WebhookEvent.eventId` (unique) provides idempotency for Stripe/Razorpay webhook processing.

**Full detail:** see SERVICE-DEPENDENCY-MAP.md, SIDE-EFFECT-MAP.md, IDEMPOTENCY-MATRIX.md, ROLLBACK-MATRIX.md.

## 5. Known Architectural Inconsistencies (documented, not fixed — see BUG-BASELINE.md)

- Three divergent worker bootstrap entry points (`jobs/worker.ts`, `lib/workers.ts`, `jobs/embedding.job.ts`).
- Two independent, non-communicating coupon-logic implementations (`lib/services/coupon-service.ts`, uncalled, vs. `app/(admin)/admin/coupons/actions.ts` + `enterprise-commerce-service.ts`, actually used).
- Two independent stock-mutation implementations (Server Action vs. REST route) with diverging revalidation targets and feature parity.
- `ServiceEngagement`/`ServiceMilestone` (escrow) models exist in schema and migration SQL but have zero implementing business logic anywhere — confirmed unused scaffolding.
- Several admin routes bypass `requireAdmin()` in favor of inline `session.user.role` checks (`app/api/admin/revenue/route.ts`, refund approve/deny routes), skipping the zero-trust DB re-check and subadmin permission matrix that every other admin route relies on.

These do not block Phase 0 conclusions, but they materially affect which existing route/function is the "correct" adapter target for a future MCP tool — flagged per-capability in CAPABILITY-MATRIX.md.
