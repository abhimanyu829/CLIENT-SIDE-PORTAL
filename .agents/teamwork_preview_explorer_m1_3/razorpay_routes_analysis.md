# Razorpay & API Routes Analysis Report

**Milestone:** Milestone 1 — Subscription & Billing Center  
**Explorer:** Explorer 3  
**Date:** 2026-07-23  
**Working Directory:** `c:\Users\Abhimanyu\Desktop\start-client\.agents\teamwork_preview_explorer_m1_3`  
**Target Project:** `c:\Users\Abhimanyu\Desktop\start-client`

---

## 1. Executive Summary & Project Structure Note

> **Important Directory Structure Note:**  
> The project codebase uses Next.js App Router directly under the root directory (`app/`, `lib/`, `components/`, `prisma/`). There is **no `src/` directory** wrapper in this repository. All references in tasks to `src/lib/` or `src/app/api/` correspond directly to `lib/` and `app/api/` at the workspace root.

This investigation provides a complete structural analysis of the existing Razorpay integration, API routing conventions, Admin panel capabilities, subscription services, and invoice workflows within `c:\Users\Abhimanyu\Desktop\start-client`.

---

## 2. Existing Razorpay Integration Architecture

The codebase currently has a functional Razorpay integration supporting standard one-time checkouts, buy-now flows, webhook events, signature verification, and manual admin reconciliation.

### 2.1 Core Razorpay Client (`lib/razorpay.ts`)
- **Initialization:** Uses a lazy singleton pattern (`getRazorpay()`) with a fallback `Proxy` wrapper (`razorpay`).
- **Environment Variables:** Evaluated strictly via `@/lib/env`:
  - `RAZORPAY_KEY_ID`: Server-side API key ID.
  - `RAZORPAY_KEY_SECRET`: Server-side API secret key.
  - `NEXT_PUBLIC_RAZORPAY_KEY_ID`: Exposed key ID for frontend checkout popup.
  - `RAZORPAY_WEBHOOK_SECRET`: Webhook payload verification secret.
- **Safety:** If keys are missing, `getRazorpay()` logs an explicit error and returns `null`, preventing runtime crashes and allowing clean error responses (`503 RAZORPAY_NOT_CONFIGURED`).

### 2.2 API Routes Overview (`app/api/payments/razorpay/...`)

| Route | Method | Purpose & Implementation Details |
|---|---|---|
| `/api/payments/razorpay/order` | `POST` | **Order Creation Endpoint**:<br>- Authenticates via `auth()`, checks `isVerified` and `isBanned` on `User`.<br>- Supports `mode: "cart"` and `mode: "buy_now"`.<br>- Server-side pricing enforcement (`createBuyNowCart`, `createOrderFromActiveCart`).<br>- Duplicate order prevention: reuses existing `PENDING` DB order and Razorpay Order ID if `pendingOrderId` is passed.<br>- Validates inventory (`inventoryEnabled` & `inventoryCount`).<br>- Converts grand total to paise (`toPaise()`) for Razorpay API (`payment_capture: 1`).<br>- Attaches metadata notes (userId, orderId, cartId, checkoutSessionId).<br>- Calls `attachGatewayOrder()` to save payment record in DB. |
| `/api/payments/razorpay/verify` | `POST` | **Client Callback Verification Endpoint**:<br>- Validates authenticated user session.<br>- Verifies HMAC-SHA256 signature (`${razorpay_order_id}\|${razorpay_payment_id}`) against `RAZORPAY_KEY_SECRET` using `crypto.timingSafeEqual` with hex buffers.<br>- Idempotent processing: Returns immediate success if Order status is already `PAID`/`FULFILLED` or `Payment` with `gatewayPaymentId` exists.<br>- Triggers `markOrderPaid()` and async `fulfillOrder()`. |
| `/api/payments/razorpay/webhook` | `POST` | **Asynchronous Webhook Event Handler**:<br>- Validates `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET`.<br>- Guarantees idempotency and durability via `WebhookEvent` database table (`PENDING` -> `PROCESSED` / `FAILED` / `DEAD`).<br>- Handles 12 event types (see Section 2.3). |
| `/api/payments/razorpay/status` | `GET` | **Order Payment Status & Reconciliation**:<br>- Accepts `orderId` query parameter.<br>- If order is `PENDING`, queries Razorpay API `orders.fetchPayments(gatewayOrderId)` to detect captured payments missed by client callback or webhook.<br>- Auto-reconciles order state if captured payment is found. |

### 2.3 Webhook Event Handlers (`app/api/payments/razorpay/webhook/route.ts`)
The webhook handler processes the following events:
1. `payment.captured`: Calls `markOrderPaid()` and `fulfillOrder()`. For subscriptions, updates or creates `Subscription` record with `SubStatus.ACTIVE`, syncs entitlements (`syncSubscriptionAccessState`), queues invoice generation (`invoiceQueue`).
2. `payment.authorized`: Tracks authorization event awaiting capture.
3. `payment.failed`: Calls `markOrderPaymentFailed()`. If an active subscription exists, calls `markSubscriptionPastDue()` and enqueues dunning (`notifQueue`).
4. `order.paid`: Alternative fallback to `payment.captured` for one-time orders.
5. `subscription.charged`: Updates `Subscription` start/end period, creates payment entry, enqueues invoice generation.
6. `subscription.activated`: Sets `SubStatus.ACTIVE`, syncs entitlements, emits `SUBSCRIPTION_ACTIVATED` event, sends welcome email.
7. `subscription.halted`: Marks subscription `PAST_DUE`, starts dunning queue, sends alert notification.
8. `subscription.paused`: Sets `SubStatus.PAUSED`, syncs entitlements, emits event.
9. `subscription.resumed`: Sets `SubStatus.ACTIVE`, resets current period, syncs entitlements.
10. `subscription.cancelled`: Calls `cancelSubscription()`, notifies user.
11. `refund.processed`: Marks `Payment` as `REFUNDED`, revokes access via `revokeUserAccessForOrder()`, creates audit log and notification.
12. `dispute.created`: Marks `Payment` as `DISPUTED`, creates audit log and notification.

### 2.4 Frontend Standard Checkout (`app/(public)/checkout/CheckoutClient.tsx`)
- Loads Razorpay JS SDK (`https://checkout.razorpay.com/v1/checkout.js`) with a 10-second timeout.
- Initializes standard checkout modal `new window.Razorpay(options)`.
- Handles user modal dismissal cleanly (resets UI loading state).
- Submits payment response (`razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`) to `/api/payments/razorpay/verify`.

---

## 3. Existing API & Admin Route Conventions

### 3.1 API Route Design Conventions (`app/api/...`)
- **Authentication & Context:** Every endpoint invokes `await auth()`. Unauthenticated requests return `401 Unauthorized`.
- **Validation:** Inputs are validated via `zod` schemas. Bad requests return `400 Bad Request`.
- **Database Mutability:** Critical mutations execute inside `db.$transaction()` to guarantee atomicity.
- **Audit & Analytics:** State changes call `auditLog()` (`lib/admin-audit.ts`) and `emitEvent()` (`lib/services/event-bus.ts`).
- **Response Format:** Standard JSON response shape:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
  or on error:
  ```json
  {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable message"
    }
  }
  ```

### 3.2 Admin Route Architecture (`app/(admin)/admin/...` & `app/api/admin/...`)
- **Role Control:** Protected by `SUPER_ADMIN` and `SUB_ADMIN` role checks.
- **Payments Inspection (`app/(admin)/admin/payments/PaymentsInspectionClient.tsx`):**
  - Displays checkout failures, gateway states, and webhook delivery status.
  - Features single-click reconciliation via `/api/payments/razorpay/status`.
  - Direct deep links to Razorpay Merchant Dashboard (`https://dashboard.razorpay.com/app/orders/{gatewayOrderId}`).
- **Products & Tiers Management (`app/(admin)/admin/products/AdminProductsClient.tsx` & `actions.ts`):**
  - Tiers include gateway-specific plan IDs (e.g., `razorpayPlanId`, `stripePriceId`).

---

## 4. Existing Subscription & Invoice Infrastructure

### 4.1 Subscription Service (`lib/services/subscription-service.ts`)
Centralized lifecycle management module using `prisma.$transaction()`:
- `activateSubscription(subscriptionId, actorId)`: Activates sub, syncs entitlements, sets 3-hour refund window (`refundEligibleUntil`), emits `SUBSCRIPTION_ACTIVATED`.
- `changePlan(subscriptionId, newTierId, adminId, reason)`: Atomically updates plan tier, updates entitlements, logs pricing history.
- `cancelSubscription(subscriptionId, adminId, reason)`: Sets status to `CANCELLED`, revokes/expires entitlements.
- `pauseSubscription()` / `reactivateSubscription()`: Pauses or restores subscription status and access entitlements.
- `markSubscriptionPastDue()` / `startGracePeriod()`: Manages payment retries and grace periods (default 3 days).
- `expireOverdueSubscriptions()` / `cancelExpiredGracePeriods()`: Background job helpers for automatic subscription expiration.
- Cache Invalidation: Automatically clears Redis access caches (`clearUserAccessCaches`).

### 4.2 Invoice Service (`lib/services/invoice-service.ts`)
- `generateInvoiceArtifact(paymentId)`: Idempotently creates an `Invoice` record (`INV-XXXXXXXX`) linked to `Payment`, `Order`, `Subscription`, and `User`. Computes total and line items.
- Sets PDF render URL: `/api/invoices/[id]/render`.
- `sendInvoiceEmail(paymentId)`: Renders React email template (`InvoiceEmail`) and sends via `sendEmail()` (`lib/resend.ts`).

---

## 5. Blueprint to Extend Razorpay for Subscription Payments & Full Lifecycle Management

To support recurring subscriptions and the required status lifecycle (**Pending -> Active -> Renewed -> Suspended -> Expired -> Cancelled -> Archived**), the following extension architecture must be implemented:

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 Subscription Checkout                   │
                  │   POST /api/payments/razorpay/subscription-order      │
                  └──────────────────────────┬──────────────────────────────┘
                                             │
                                             ▼
                  ┌─────────────────────────────────────────────────────────┐
                  │                     Status: PENDING                     │
                  │   Order / Subscription Created in DB (Unverified)     │
                  └──────────────────────────┬──────────────────────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │ Payment Callback / Webhook                │
                       ▼                                           ▼
          [Signature Verified]                           [Payment Failed]
                       │                                           │
                       ▼                                           ▼
     ┌───────────────────────────────────┐       ┌───────────────────────────────────┐
     │          Status: ACTIVE           │       │         Status: SUSPENDED         │
     │ - Entitlement Granted             │       │ - Past Due / Grace Period Started │
     │ - Invoice Generated & Emailed     │       │ - Dunning Triggered               │
     └─────────────────┬─────────────────┘       └─────────────────┬─────────────────┘
                       │                                           │
         ┌─────────────┴─────────────┐                ┌────────────┴────────────┐
         │ Recurring Billing         │                │ Grace Period Expired    │
         ▼                           ▼                ▼                         ▼
┌──────────────────┐       ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Status: RENEWED  │       │Status: CANCELLED │  │ Status: EXPIRED  │  │ Status: ARCHIVED │
│ (Period Extended │       │ (User/Admin      │  │ (Auto-Cancelled  │  │ (Retention       │
│ + Invoice Issued)│       │  Initiated)      │  │  after Grace)    │  │  Policy Clean)   │
└──────────────────┘       └──────────────────┘  └──────────────────┘  └──────────────────┘
```

### 5.1 Step-by-Step Extension Details

#### Step 1: Subscription Checkout Endpoint & Price Validation
- Endpoint: `POST /api/payments/razorpay/subscription-order` (or enhanced `/api/payments/razorpay/order` with `mode: "subscription"`).
- Backend Price Validation:
  1. Fetch `ProductTier` by `tierId` from database.
  2. Verify tier is active (`isActive: true`) and public/purchasable.
  3. Retrieve price, currency, interval (`MONTHLY`, `YEARLY`).
  4. If `tier.razorpayPlanId` exists, create Razorpay Subscription via `client.subscriptions.create({ plan_id: tier.razorpayPlanId, total_count: ... })`.
  5. If custom price/order, create standard Razorpay Order with notes specifying `subscriptionTierId` and `isSubscription: true`.
- Initial DB Record: Create `Subscription` record with status `PENDING` (or create `Order` with `OrderStatus.PENDING`).

#### Step 2: Payment Callback Verification
- Endpoint: `POST /api/payments/razorpay/verify` (enhance to support subscription signatures).
- Signature Verification:
  - For standard Razorpay Order: HMAC-SHA256 of `razorpay_order_id|razorpay_payment_id` against `RAZORPAY_KEY_SECRET`.
  - For Razorpay Subscription: HMAC-SHA256 of `razorpay_payment_id|razorpay_subscription_id` against `RAZORPAY_KEY_SECRET`.
- Transaction & Transition:
  - Call `activateSubscription(subscriptionId, userId)`.
  - Atomically update subscription status to `ACTIVE`, compute `currentPeriodStart` and `currentPeriodEnd`.
  - Create active `CustomerEntitlement`.
  - Return `redirectUrl: "/dashboard/subscriptions"`.

#### Step 3: Webhook Event Handling for Subscription Lifecycle & Renewals
Update `app/api/payments/razorpay/webhook/route.ts`:
- **`subscription.activated` / `payment.captured`:** Transitions status to `ACTIVE`. Triggers `generateInvoiceArtifact()` and `sendInvoiceEmail()`.
- **`subscription.charged` (Renewed State):**
  - Invoked upon automatic recurring charge by Razorpay.
  - Updates `currentPeriodStart` and `currentPeriodEnd`.
  - Creates new `Payment` record with `status: PaymentStatus.SUCCESS`.
  - Generates new `Invoice` (`INV-XXXXXXXX`) for the renewal period.
  - Emits `EVENTS.SUBSCRIPTION_RENEWED`.
- **`payment.failed` / `subscription.halted` (Suspended State):**
  - Calls `markSubscriptionPastDue()` / `startGracePeriod(subscriptionId, actorId, reason, 3)`.
  - Updates subscription status to `PAST_DUE` (Suspended).
  - Triggers dunning notifications.
- **`subscription.cancelled` (Cancelled State):**
  - Calls `cancelSubscription()`. Sets `status: SubStatus.CANCELLED`.
  - Revokes entitlements at period end or immediately according to `cancelAtPeriodEnd`.

#### Step 4: Scheduled Background Lifecycle Management (Expired & Archived)
- **Expired State:**
  - Cron / worker execution of `cancelExpiredGracePeriods()` and `expireOverdueSubscriptions()`.
  - If a `PAST_DUE` subscription exceeds its `gracePeriodEnd` without successful charge, status transitions to `CANCELLED` / `EXPIRED` and entitlements are revoked.
- **Archived State:**
  - Subscriptions cancelled for over 180 days (or configured retention window) are marked as `ARCHIVED` via scheduled cleanup job for database hygiene.

#### Step 5: Automatic Invoice Generation Integration
- Hook directly into `payment.captured` and `subscription.charged` events.
- Invoice fields populated:
  - `number`: `INV-{PAYMENT_ID_SUFFIX}`
  - `totalAmount`: Charged amount
  - `taxAmount`: Tax split based on region/billing address
  - `lineItems`: Includes plan tier name, interval description, and active date range.
- PDF generation handled dynamically via `/api/invoices/[id]/render`.

---

## 6. Summary Table of Files Inspected

| File Path | Role in Architecture |
|---|---|
| `lib/razorpay.ts` | Lazy Razorpay client singleton & Proxy export. |
| `app/api/payments/razorpay/order/route.ts` | Server-side pricing, buy-now & cart order creation with Razorpay API. |
| `app/api/payments/razorpay/verify/route.ts` | Timing-safe HMAC signature verification & payment settlement. |
| `app/api/payments/razorpay/webhook/route.ts` | Idempotent webhook listener & multi-event dispatcher. |
| `app/api/payments/razorpay/status/route.ts` | Order status polling & API fallback reconciliation. |
| `lib/services/subscription-service.ts` | Centralized transactional subscription lifecycle & entitlement manager. |
| `lib/services/invoice-service.ts` | Invoice artifact generator & email dispatcher. |
| `app/(public)/checkout/CheckoutClient.tsx` | Frontend Razorpay modal checkout component. |
| `app/(admin)/admin/payments/PaymentsInspectionClient.tsx` | Admin payment failure inspection & Razorpay reconciliation UI. |
| `app/api/subscriptions/route.ts` & `[id]/cancel/route.ts` | End-user subscription management API endpoints. |
