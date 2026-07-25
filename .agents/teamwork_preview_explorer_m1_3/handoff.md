# Handoff Report — Razorpay & API Routes Analysis

**Milestone:** Milestone 1 — Subscription & Billing Center  
**Explorer:** Explorer 3  
**Date:** 2026-07-23  
**Working Directory:** `c:\Users\Abhimanyu\Desktop\start-client\.agents\teamwork_preview_explorer_m1_3`

---

## 1. Observation

Direct observations from inspecting the codebase:

1. **Project Directory Layout**:
   - The workspace does not contain a `src/` directory. All application files are at root: `app/`, `lib/`, `components/`, `prisma/`.
   - Verified via tool output: `find_by_name` on `c:\Users\Abhimanyu\Desktop\start-client\src` returned error `directory c:\Users\Abhimanyu\Desktop\start-client\src does not exist`.

2. **Razorpay Client (`lib/razorpay.ts`)**:
   - Lines 11–25: `getRazorpay()` reads `env.RAZORPAY_KEY_ID` and `env.RAZORPAY_KEY_SECRET` from `@/lib/env` and lazily instantiates `new Razorpay({ key_id, key_secret })`. Returns `null` if keys are missing.
   - Lines 38–46: Proxy export `razorpay` forwards calls to `getRazorpay()`.

3. **Order Creation (`app/api/payments/razorpay/order/route.ts`)**:
   - Lines 44–79: Authenticates user session with `auth()`, verifies account status (`!user.isVerified` -> 403, `user.isBanned` -> 403).
   - Lines 114–167: Reuses existing `PENDING` DB order & Razorpay order if `pendingOrderId` parameter is present.
   - Lines 172–264: Validates inventory and calculates cart/buy-now amounts server-side using `createBuyNowCart()` or `createOrderFromActiveCart()` from `lib/services/enterprise-commerce-service.ts`.
   - Lines 287–306: Converts total amount to paise via `toPaise(order.grandTotal)` and creates Razorpay order (`client.orders.create(...)`).
   - Lines 325–329: Attaches gateway order ID via `attachGatewayOrder()`.

4. **Signature Verification (`app/api/payments/razorpay/verify/route.ts`)**:
   - Lines 18–39: `verifySignature()` computes `crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex")` and compares using `crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))`.
   - Lines 69–80: Idempotent return if order is already `PAID` or `FULFILLED`.
   - Lines 110–116: Calls `markOrderPaid()` and asynchronously triggers `fulfillOrder()`.

5. **Webhook Dispatcher (`app/api/payments/razorpay/webhook/route.ts`)**:
   - Lines 24–33: HMAC-SHA256 signature verification against `env.RAZORPAY_WEBHOOK_SECRET`.
   - Lines 500–530: Persists and tracks webhook events in `db.webhookEvent` table (`PENDING` -> `PROCESSED` / `FAILED` / `DEAD`) for strict idempotency.
   - Lines 534–573: Handles 12 event types: `payment.captured`, `payment.authorized`, `payment.failed`, `order.paid`, `subscription.charged`, `subscription.halted`, `subscription.activated`, `subscription.cancelled`, `subscription.paused`, `subscription.resumed`, `refund.processed`, `dispute.created`.

6. **Subscription & Invoice Services**:
   - `lib/services/subscription-service.ts`: Lines 507–586 implement `activateSubscription()`, atomically transitioning status to `ACTIVE`, updating entitlements in `db.customerEntitlement`, setting 3-hour refund window (`refundEligibleUntil`), and invalidating Redis access caches (`clearUserAccessCaches`).
   - `lib/services/invoice-service.ts`: Lines 12–57 implement `generateInvoiceArtifact()`, creating an `Invoice` record (`INV-XXXXXXXX`) with status `PAID` upon successful payment. Lines 59–86 implement `sendInvoiceEmail()`.

---

## 2. Logic Chain

1. **Observation 1** establishes that all path references in documentation must refer to root level `app/` and `lib/` (not `src/`).
2. **Observation 2** shows that Razorpay SDK initialization is already safely encapsulated and environment-validated in `lib/razorpay.ts`.
3. **Observations 3 & 4** show that standard one-time payment order creation, backend price validation, inventory checks, and timing-safe signature verification are fully implemented for standard checkouts.
4. **Observation 5** demonstrates that the webhook infrastructure (`app/api/payments/razorpay/webhook/route.ts`) already includes event routing and database-backed idempotency via `WebhookEvent`, including placeholders/handlers for `subscription.charged`, `subscription.activated`, `subscription.halted`, `subscription.paused`, `subscription.resumed`, `subscription.cancelled`.
5. **Observation 6** demonstrates that the database layer (`lib/services/subscription-service.ts`) already possesses transactional atomic state transition logic (`activateSubscription`, `changePlan`, `cancelSubscription`, `pauseSubscription`, `markSubscriptionPastDue`, `startGracePeriod`, `expireOverdueSubscriptions`) and invoice generation (`lib/services/invoice-service.ts`).
6. **Conclusion**: Extending the existing architecture to support full subscription lifecycle management requires linking the Razorpay Subscription API (`client.subscriptions.create`) into order creation, extending signature verification for subscription payments, routing recurring `subscription.charged` webhooks to issue recurring invoices, and invoking scheduled background routines for expired grace periods.

---

## 3. Caveats

- **Razorpay Subscription Plan Configuration**: Product tiers in `db.productTier` have a field `razorpayPlanId`. In production, plans must be pre-created on the Razorpay Dashboard or synced via API to generate valid `plan_NXXXXX...` IDs.
- **Environment Variables**: Local test environment requires valid `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in `.env`.
- **Background Cron Execution**: Functions `expireOverdueSubscriptions()` and `cancelExpiredGracePeriods()` exist in `subscription-service.ts`, but require a periodic runner (e.g. Next.js cron route, BullMQ worker, or scheduled task) to execute automatically.

---

## 4. Conclusion

The Razorpay integration and API route architecture in `c:\Users\Abhimanyu\Desktop\start-client` is mature, modular, and secure. It follows clear Next.js App Router conventions with Zod validation, Auth.js session authentication, timing-safe HMAC signature verification, database transaction safety, and Redis cache invalidation.

Detailed report generated at: `.agents/teamwork_preview_explorer_m1_3/razorpay_routes_analysis.md`.

---

## 5. Verification Method

To verify these findings independently:

1. **Verify Project Structure**:
   - Inspect top-level directory: `ls c:\Users\Abhimanyu\Desktop\start-client\app\api\payments\razorpay`.
   - Confirm existence of `order/route.ts`, `verify/route.ts`, `webhook/route.ts`, `status/route.ts`.

2. **Verify Razorpay Client Initialization**:
   - Inspect `c:\Users\Abhimanyu\Desktop\start-client\lib\razorpay.ts`.
   - Confirm lazy loading via `getRazorpay()` and environment variable reading from `lib/env.ts`.

3. **Verify Lifecycle & Service Capabilities**:
   - Inspect `c:\Users\Abhimanyu\Desktop\start-client\lib\services\subscription-service.ts` for functions: `activateSubscription`, `changePlan`, `cancelSubscription`, `pauseSubscription`, `startGracePeriod`, `expireOverdueSubscriptions`.
   - Inspect `c:\Users\Abhimanyu\Desktop\start-client\lib\services\invoice-service.ts` for `generateInvoiceArtifact` and `sendInvoiceEmail`.

4. **Invalidation Conditions**:
   - If `src/` directory is introduced in a future refactor, paths will need updating.
   - If Razorpay SDK version breaks current `Razorpay` constructor options or `orders.create` params.
