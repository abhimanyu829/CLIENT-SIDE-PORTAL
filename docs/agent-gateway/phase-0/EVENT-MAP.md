# Phase 0 — Event / Queue / Worker / Cache-Reflection Map

## Domain events (`lib/services/event-bus.ts`, `EVENTS` constant, ~46 names)

Full list: `USER_CREATED, USER_BANNED, USER_UNBANNED, USER_ROLE_CHANGED, USER_DELETED, SUBSCRIPTION_ACTIVATED, SUBSCRIPTION_CANCELLED, SUBSCRIPTION_PAUSED, SUBSCRIPTION_REACTIVATED, PLAN_CHANGED, PAYMENT_SUCCESS, PAYMENT_FAILED, REFUND_PROCESSED, REFUND_REQUESTED, COUPON_CREATED, COUPON_APPLIED, COUPON_DEACTIVATED, CAMPAIGN_STARTED, CAMPAIGN_STOPPED, AI_USAGE_RECORDED, QUOTA_EXCEEDED, QUOTA_OVERRIDDEN, FRAUD_FLAGGED, FEATURE_FLAG_TOGGLED, WEBHOOK_RECEIVED, WEBHOOK_REPLAYED, WEBHOOK_DEAD, PRODUCT_CREATED, PRODUCT_UPDATED, TIER_PRICE_CHANGED, VENDOR_CREATED, VENDOR_VERIFIED, CART_UPDATED, ORDER_CREATED, ORDER_PAID, ENTITLEMENT_GRANTED, SERVICE_ENGAGEMENT_CREATED, AGENT_DEPLOYED, USER_VERIFIED, PREVIEW_STARTED, PREVIEW_EXPIRED, PREVIEW_REVOKED, ORDER_FULFILLED, CREDENTIAL_DELIVERED, ENTITLEMENT_REVOKED, INVENTORY_UPDATED, PRODUCT_SOLD_OUT`.

**Channel routing is payload-shape-driven, not event-name-driven** — every event always hits `admin-dashboard`, and additionally hits `private-user-{userId}` / `product-{productId}` / `preview-{sessionId}` if the payload happens to carry those fields, regardless of which event it is.

**Implication:** a future Agent Gateway audit consumer wanting to react to "AI-caused mutations only" cannot filter by event name alone reliably for user/product/preview-scoped notifications — the payload shape, not a dedicated event category, determines fanout. If Phase 1+ wants an AI-attributed activity feed, it will need either a new payload field (e.g. `actorType: "agent"`) threaded through `emitEvent()` calls, or a parallel channel.

## Webhook endpoints (inbound — never agent-invoked capabilities, but relevant to gateway threat modeling)

| Endpoint | Service | Verification |
|---|---|---|
| `/api/webhooks/clerk` | Clerk (user sync) | Svix HMAC (built-in timestamp tolerance — the only replay protection in the entire app, and it's third-party) |
| `/api/webhooks/resend` | Resend (email events) | Static shared-secret string compare — **not HMAC, not constant-time** |
| `/api/webhooks/paytm` | Paytm | **None** — inert stub, log-only, no state mutation |
| `/api/webhooks/phonepe` | PhonePe | **None** — inert stub, log-only, no state mutation |
| `/api/payments/razorpay/webhook` | Razorpay | HMAC-SHA256 + `timingSafeEqual` (correct) |
| `/api/payments/stripe/webhook` | Stripe | SDK `constructEvent` (correct) |

## Cron / recurring jobs (BullMQ repeatable, all require a persistent worker process)

| Job | Schedule | Registered in |
|---|---|---|
| `subscription.expire-overdue` | every 5 min | `lib/workers.ts::scheduleRecurringJobs()` |
| `subscription.reconcile` | hourly | same |
| `payment.reconcile` | hourly (offset :05) | same |
| `campaign.sync` | every 5 min | `jobs/campaign.job.ts::scheduleCampaignSync()` |

**No Vercel Cron, no `app/api/cron/**` route exists.** All recurring business logic depends entirely on one of the ambiguous worker processes (see SERVICE-DEPENDENCY-MAP.md) actually running continuously in production.

## ISR / cache revalidation (`lib/revalidate.ts`)

7 named functions covering tags `products, featured-products, home-products, trending, pricing, agents, marketplace-data, campaigns, active-campaign, platform-stats, blog, agent-data` and paths `/`, `/marketplace`, `/marketplace/{slug}`, `/ai-agents`, `/pricing`, `/blog`, `/blog/{slug}`.

## UI reflection mechanisms (confirmed, all three)

1. **Pusher realtime** — via `emitEvent()`.
2. **ISR revalidation** — via `lib/revalidate.ts`, called inline from admin actions/routes.
3. **Client-side polling** (`fetch()` + `setInterval`) — confirmed in `SuccessClient.tsx` (checkout success, exponential backoff, Pusher-fallback), dashboard `page.tsx` (60s stats), `ActivityFeed.tsx` (30s), `CustomServiceDiscussionClient.tsx` (8s, explicit Pusher+polling hybrid), `PreviewSandbox.tsx` (preview session status).

No SWR or React Query is used anywhere — confirmed via full-codebase grep.

**Implication for Phase 1+:** an AI-triggered mutation must trigger the *same* combination of these three mechanisms the human path already does (via calling the same service/action, not reimplementing notification logic) for the UI to reflect an agent's change identically to an admin's change — this is the literal meaning of "human and AI must eventually use the same business truth" from the architecture spec.
