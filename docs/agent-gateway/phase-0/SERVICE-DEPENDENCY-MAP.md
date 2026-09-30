# Phase 0 — Service Dependency Map

## Layered dependency graph (human path, confirmed by code)

```
Frontend (Server/Client Component)
   │
   ▼
Route Handler (app/api/**/route.ts)  OR  Server Action (app/**/actions.ts)
   │  - requireAdmin() / requireApiAuth() / auth() [inconsistently applied — see AUTHORIZATION-MATRIX.md]
   │  - zod validation [inconsistently applied]
   ▼
lib/services/*.ts  (business logic — subscription-service, refund-service, invoice-service,
   │                enterprise-commerce-service, service-commerce, service-lifecycle-service,
   │                coupon-service [mostly dead], ai-quota-service, manual-payment-verification,
   │                cache-service, event-bus, phone-verification-gate, clerk-user-sync)
   ▼
Prisma (lib/db.ts singleton, retry-wrapped for Supabase cold-start)
   ▼
PostgreSQL (Supabase, pgvector extension)
```

## Queue/worker dependency graph

```
lib/services/*.ts  or  route handler
   │
   ▼
lib/queue.ts  (createLazyQueue — no-ops silently if REDIS_URL unset)
   │
   ▼
BullMQ Queue (email, payment, subscription, invoice, preview, notifications, analytics, audit, ai)
   │
   ▼
Worker process — THREE POSSIBLE ENTRY POINTS, not confirmed which runs in production:
   ├── jobs/worker.ts        (imports invoice.job, email.job, dunning.job, abandonment.job, campaign.job)
   ├── lib/workers.ts        (registers subscription/invoice/notifications/email/payment/preview workers directly)
   └── jobs/embedding.job.ts (Procfile's `worker:` target — standalone, embedding-only)
```

**This ambiguity is a Phase 0 blocker for one specific claim only:** the architecture doc's assumption that "the existing event/queue system" is a single, known pipeline the gateway can safely trigger into. It is not single — it is two-to-three independently evolved bootstraps with overlapping queue-name registrations (see BUG-BASELINE.md #1). Before Phase 1 wires any AI-triggered async job, this must be operationally resolved (confirm which worker(s) actually run in the deployed environment).

## Event/cache dependency graph

```
Any mutation site
   │
   ├──▶ db.$transaction(...)  [not always present — see TRANSACTION/IDEMPOTENCY notes per capability]
   │        │
   │        ▼
   │    AuditLog.create()  [confirmed append-only everywhere]
   │
   ├──▶ emitEvent(EVENTS.X, payload)  — lib/services/event-bus.ts
   │        │
   │        ├──▶ Pusher channel(s) selected by payload SHAPE not event name
   │        │      (admin-dashboard always; private-user-{userId} if payload.userId;
   │        │       product-{productId} if payload.productId; preview-{sessionId} if payload.sessionId)
   │        ├──▶ Redis cache invalidation (EVENT_CACHE_INVALIDATION map)
   │        └──▶ platform:activity Redis ZSET (public activity ticker, capped 50/24h)
   │
   └──▶ lib/revalidate.ts revalidateTag()/revalidatePath()  — ISR cache busting
            (products, campaigns, platform-stats, blog, agents, pricing, marketplace-data tags)
```

Additionally, several dashboard/checkout/preview components use plain `fetch()` + `setInterval` client-side polling as a third reflection mechanism (confirmed: `SuccessClient.tsx`, dashboard `page.tsx` 60s, `ActivityFeed.tsx` 30s, `CustomServiceDiscussionClient.tsx` 8s fallback, `PreviewSandbox.tsx`) — no SWR/React Query library is used anywhere.

## Which layer can the future Agent Gateway safely call?

Per the architecture spec's own principle ("the gateway may import existing backend service interfaces... it must not import raw DB access simply to perform an AI operation"):

- **Safe adapter target:** `lib/services/*.ts` functions, where they exist and are actually the canonical implementation (see per-capability NOTES in CAPABILITY-MATRIX.md — some "services" like `coupon-service.ts` are dead code and must NOT be the adapter target; the real logic lives in the Server Action instead).
- **Safe adapter target (fallback):** the Server Action / Route Handler itself, when business logic is inlined there rather than factored into `lib/services` (common pattern in this codebase — e.g. most of Products domain logic lives directly in `app/(admin)/admin/products/actions.ts`, not a separate service file).
- **Never a safe target:** raw Prisma calls, even read-only ones, bypassing the auth/validation layer that wraps them today.
