# Subscription & Billing Center — Prisma Schema Extension Design

**Milestone**: 1 — Subscription & Billing Center Foundation  
**Author**: Explorer 2 (`teamwork_preview_explorer_m1_2`)  
**Target Repository**: `start-client`  
**Schema File**: `prisma/schema.prisma`  

---

## 1. Executive Summary

This document presents the complete schema design extension for the **Subscription & Billing Center** module within the `start-client` application. The design introduces dedicated models for multi-tiered subscription plans, granular plan benefits, premium catalog services, addon features, active user subscriptions, recurring billing invoices, and subscription payments.

The proposed schema is fully compatible with the existing `prisma/schema.prisma` database models, avoiding breaking changes while providing explicit, clean relations to `User` and existing `ServiceCategory` entities.

---

## 2. Existing Schema Audit & Analysis

Prior to designing the extensions, `prisma/schema.prisma` (2,803 lines) was analyzed. The following relevant models and enums were inspected:

### Existing Models & Enums
1. **`User` (lines 304–395)**:
   - Primary user identity containing `id`, `email`, `clerkUserId`, `stripeCustomerId`, etc.
   - Currently linked to `subscriptions Subscription[]`, `payments Payment[]`, `invoices Invoice[]`, `serviceSubscriptions ServiceSubscription[]`, etc.
   - *Extension requirement*: Add clean relations for `userSubscriptions UserSubscription[]`, `subscriptionInvoices SubscriptionInvoice[]`, and `subscriptionPayments SubscriptionPayment[]`.
2. **`ServiceCategory` (lines 2128–2138)**:
   - Catalog category model containing `id`, `slug`, `name`, `description`, `isActive`, `sortOrder`.
   - Currently linked to `services ServicePage[]`.
   - *Extension requirement*: Add back-relation `premiumServices PremiumService[]`.
3. **Existing `Subscription` (lines 806–831)**:
   - Legacy/Product-tier focused subscription model linked to `Product` and `ProductTier`.
   - *Note*: Our new `UserSubscription` model handles full platform/SaaS billing, plan upgrades, addon services, and recurring subscription invoices without conflicting with existing product-specific tiers.
4. **Existing `Payment` & `Invoice` (lines 833–879)**:
   - Order & single product billing models.
   - *Note*: Dedicated `SubscriptionInvoice` and `SubscriptionPayment` models provide clean separation of recurring subscription billing audit trails.

---

## 3. Schema Design Architecture & Enums

### 3.1 New Enums

```prisma
enum SubscriptionStatus {
  TRIALING
  ACTIVE
  PAST_DUE
  CANCELED
  UNPAID
  PAUSED
  EXPIRED
}

enum BillingCycle {
  MONTHLY
  QUARTERLY
  SEMI_ANNUAL
  YEARLY
  LIFETIME
  USAGE_BASED
}

enum PriceCurrency {
  USD
  EUR
  GBP
  INR
  CAD
  AUD
}

enum PlanTier {
  FREE
  STARTER
  PRO
  AGENCY
  ENTERPRISE
}

enum BenefitType {
  FEATURE
  LIMIT
  SUPPORT
  INTEGRATION
  DISCOUNT
}

enum AddonPricingType {
  FLAT_RECURRING
  PER_UNIT_RECURRING
  ONE_TIME
}

enum SubscriptionInvoiceStatus {
  DRAFT
  OPEN
  PAID
  UNCOLLECTIBLE
  VOID
}

enum SubscriptionPaymentStatus {
  PENDING
  SUCCESS
  FAILED
  REFUNDED
  PARTIALLY_REFUNDED
}

enum SubscriptionPaymentMethod {
  CREDIT_CARD
  DEBIT_CARD
  STRIPE
  RAZORPAY
  PAYPAL
  BANK_TRANSFER
  CRYPTO
  WALLET
}
```

---

## 4. Exact Prisma Schema Extension Models

Below are the exact model definitions to be added to `prisma/schema.prisma`:

```prisma
// ==============================================================================
// ── Subscription & Billing Center Models ──────────────────────────────────────
// ==============================================================================

/// Master subscription plan definitions offered on the platform (e.g. Free, Starter, Pro, Enterprise)
model SubscriptionPlan {
  id              String            @id @default(cuid())
  slug            String            @unique
  name            String
  tagline         String?
  description     String?           @db.Text
  tier            PlanTier          @default(PRO)
  billingCycle    BillingCycle      @default(MONTHLY)
  price           Decimal           @db.Decimal(10, 2)
  discountPrice   Decimal?          @db.Decimal(10, 2)
  currency        PriceCurrency     @default(USD)
  trialDays       Int               @default(0)
  isPopular       Boolean           @default(false)
  isRecommended   Boolean           @default(false)
  isActive        Boolean           @default(true)
  isCustom        Boolean           @default(false)
  sortOrder       Int               @default(0)
  stripePlanId    String?
  razorpayPlanId  String?
  metadata        Json?             @default("{}")
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  benefits        PlanBenefit[]
  subscriptions   UserSubscription[]

  @@index([slug])
  @@index([tier, isActive])
  @@index([billingCycle])
}

/// Granular features and benefit entitlements associated with a SubscriptionPlan
model PlanBenefit {
  id           String           @id @default(cuid())
  planId       String
  title        String
  description  String?          @db.Text
  benefitType  BenefitType      @default(FEATURE)
  benefitValue String?          // e.g. "10", "50GB", "Unlimited", "24/7"
  isHighlighted Boolean         @default(false)
  isIncluded   Boolean          @default(true)
  sortOrder    Int              @default(0)
  createdAt    DateTime         @default(now())
  updatedAt    DateTime         @updatedAt

  plan         SubscriptionPlan @relation(fields: [planId], references: [id], onDelete: Cascade)

  @@index([planId])
}

/// Catalog of premium services offered standalone or as plan attachments
model PremiumService {
  id               String            @id @default(cuid())
  categoryId       String?
  slug             String            @unique
  name             String
  shortDescription String
  fullDescription  String?           @db.Text
  iconUrl          String?
  bannerUrl        String?
  basePrice        Decimal           @db.Decimal(10, 2)
  currency         PriceCurrency     @default(USD)
  billingCycle     BillingCycle      @default(MONTHLY)
  isActive         Boolean           @default(true)
  isFeatured       Boolean           @default(false)
  sortOrder        Int               @default(0)
  metadata         Json?             @default("{}")
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  category         ServiceCategory?  @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  addonServices    AddonService[]

  @@index([slug])
  @@index([categoryId])
  @@index([isActive, isFeatured])
}

/// Optional addon services that users can attach to their active UserSubscription
model AddonService {
  id               String                 @id @default(cuid())
  premiumServiceId String?
  slug             String                 @unique
  name             String
  description      String?                @db.Text
  pricingType      AddonPricingType       @default(FLAT_RECURRING)
  unitName         String?                // e.g. "Seat", "GB", "API Key"
  unitPrice        Decimal                @db.Decimal(10, 2)
  currency         PriceCurrency          @default(USD)
  billingCycle     BillingCycle           @default(MONTHLY)
  maxQuantity      Int?
  isActive         Boolean                @default(true)
  sortOrder        Int                    @default(0)
  stripePriceId    String?
  razorpayPlanId   String?
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  premiumService   PremiumService?        @relation(fields: [premiumServiceId], references: [id], onDelete: SetNull)
  userAddons       UserSubscriptionAddon[]

  @@index([slug])
  @@index([premiumServiceId])
  @@index([isActive])
}

/// Active or historical user subscription instance
model UserSubscription {
  id                     String                  @id @default(cuid())
  subscriptionNumber     String                  @unique
  userId                 String
  planId                 String
  status                 SubscriptionStatus      @default(TRIALING)
  billingCycle           BillingCycle            @default(MONTHLY)
  quantity               Int                     @default(1)
  unitPrice              Decimal                 @db.Decimal(10, 2)
  discountAmount         Decimal                 @default(0) @db.Decimal(10, 2)
  taxAmount              Decimal                 @default(0) @db.Decimal(10, 2)
  totalAmount            Decimal                 @db.Decimal(10, 2)
  currency               PriceCurrency           @default(USD)
  startDate              DateTime                @default(now())
  currentPeriodStart     DateTime
  currentPeriodEnd       DateTime
  trialStartsAt          DateTime?
  trialEndsAt            DateTime?
  canceledAt             DateTime?
  endedAt                DateTime?
  cancelAtPeriodEnd      Boolean                 @default(false)
  autoRenew              Boolean                 @default(true)
  paymentMethodId        String?
  stripeSubscriptionId   String?                 @unique
  razorpaySubscriptionId String?                 @unique
  metadata               Json?                   @default("{}")
  createdAt              DateTime                @default(now())
  updatedAt              DateTime                @updatedAt

  user                   User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  plan                   SubscriptionPlan        @relation(fields: [planId], references: [id])
  addons                 UserSubscriptionAddon[]
  invoices               SubscriptionInvoice[]
  payments               SubscriptionPayment[]

  @@index([userId, status])
  @@index([planId])
  @@index([status, currentPeriodEnd])
}

/// Junction table connecting active user subscriptions with selected addon services
model UserSubscriptionAddon {
  id                 String           @id @default(cuid())
  userSubscriptionId String
  addonServiceId     String
  quantity           Int              @default(1)
  unitPrice          Decimal          @db.Decimal(10, 2)
  totalPrice         Decimal          @db.Decimal(10, 2)
  currency           PriceCurrency    @default(USD)
  addedAt            DateTime         @default(now())
  removedAt          DateTime?
  isActive           Boolean          @default(true)

  userSubscription   UserSubscription @relation(fields: [userSubscriptionId], references: [id], onDelete: Cascade)
  addonService       AddonService     @relation(fields: [addonServiceId], references: [id])

  @@unique([userSubscriptionId, addonServiceId])
  @@index([userSubscriptionId])
  @@index([addonServiceId])
}

/// Recurring billing invoices generated per subscription cycle
model SubscriptionInvoice {
  id                 String                    @id @default(cuid())
  invoiceNumber      String                    @unique
  userSubscriptionId String
  userId             String
  status             SubscriptionInvoiceStatus @default(OPEN)
  currency           PriceCurrency             @default(USD)
  subtotal           Decimal                   @db.Decimal(10, 2)
  taxTotal           Decimal                   @default(0) @db.Decimal(10, 2)
  discountTotal      Decimal                   @default(0) @db.Decimal(10, 2)
  totalAmount        Decimal                   @db.Decimal(10, 2)
  amountPaid         Decimal                   @default(0) @db.Decimal(10, 2)
  amountDue          Decimal                   @db.Decimal(10, 2)
  billingPeriodStart DateTime
  billingPeriodEnd   DateTime
  dueDate            DateTime
  paidAt             DateTime?
  voidedAt           DateTime?
  pdfUrl             String?
  lineItems          Json                      @default("[]")
  billingAddress     Json?                     @default("{}")
  stripeInvoiceId    String?                   @unique
  razorpayInvoiceId  String?                   @unique
  createdAt          DateTime                  @default(now())
  updatedAt          DateTime                  @updatedAt

  userSubscription   UserSubscription          @relation(fields: [userSubscriptionId], references: [id], onDelete: Cascade)
  user               User                      @relation(fields: [userId], references: [id], onDelete: Cascade)
  payments           SubscriptionPayment[]

  @@index([userId, status])
  @@index([userSubscriptionId])
  @@index([invoiceNumber])
  @@index([status, dueDate])
}

/// Payment transaction records linked to subscription invoices
model SubscriptionPayment {
  id                    String                    @id @default(cuid())
  paymentNumber         String                    @unique
  subscriptionInvoiceId String?
  userSubscriptionId    String
  userId                String
  amount                Decimal                   @db.Decimal(10, 2)
  currency              PriceCurrency             @default(USD)
  status                SubscriptionPaymentStatus @default(PENDING)
  paymentMethod         SubscriptionPaymentMethod @default(CREDIT_CARD)
  gateway               PaymentGateway            @default(STRIPE)
  gatewayTransactionId  String?                   @unique
  failureReason         String?
  paidAt                DateTime?
  metadata              Json?                     @default("{}")
  createdAt             DateTime                  @default(now())
  updatedAt             DateTime                  @updatedAt

  subscriptionInvoice   SubscriptionInvoice?      @relation(fields: [subscriptionInvoiceId], references: [id], onDelete: SetNull)
  userSubscription      UserSubscription          @relation(fields: [userSubscriptionId], references: [id], onDelete: Cascade)
  user                  User                      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, status])
  @@index([userSubscriptionId])
  @@index([subscriptionInvoiceId])
  @@index([gatewayTransactionId])
}
```

---

## 5. Modifications to Existing Models

To enable bi-directional navigation in Prisma without altering business logic of existing models:

### 5.1 Extension to `User` Model (around line 390 in `prisma/schema.prisma`)
Add the following fields inside `model User { ... }`:

```prisma
  // Subscription & Billing Center relations
  userSubscriptions    UserSubscription[]
  subscriptionInvoices SubscriptionInvoice[]
  subscriptionPayments SubscriptionPayment[]
```

### 5.2 Extension to `ServiceCategory` Model (around line 2137 in `prisma/schema.prisma`)
Add the following field inside `model ServiceCategory { ... }`:

```prisma
  // Subscription & Billing Center relation
  premiumServices     PremiumService[]
```

---

## 6. Entity Relationship Diagram (ERD)

```
[ User ]
   │
   ├─── 1:N ───> [ UserSubscription ] <─── N:1 ─── [ SubscriptionPlan ]
   │                    │                                 │
   │                    ├─── 1:N ───> [ UserSubscriptionAddon ] ◄── N:1 ── [ AddonService ] ◄── N:1 ── [ PremiumService ] ◄── N:1 ── [ ServiceCategory ]
   │                    │                                                                                                           (Existing)
   │                    ├─── 1:N ───> [ SubscriptionInvoice ]
   │                    │                    │
   ├─── 1:N ────────────┼────────────────────┼─── 1:N ───> [ SubscriptionPayment ]
   │                    │                    │                      │
   └────────────────────┴────────────────────┴──────────────────────┘
```

---

## 7. Key Features & Edge Case Coverage

1. **Multi-Currency Support**: Unified `PriceCurrency` enum ensures currency integrity across plans, addons, invoices, and payments.
2. **Trial Period Lifecycle**: `trialStartsAt` and `trialEndsAt` allow seamless trial-to-paid transitions.
3. **Flexible Addon Quantity & Pricing**: `UserSubscriptionAddon` records quantity, locked unit price at subscription time, and status for prorated upgrades.
4. **Proration & Invoicing Integrity**: `SubscriptionInvoice` records exact line item snapshots (`lineItems` JSON) and tracks `amountPaid` vs `amountDue` for partial payment scenarios.
5. **Gateway Agnostic Payment Ledger**: Reuses existing `PaymentGateway` enum while offering standard gateway transaction tracking (`gatewayTransactionId`, `stripeSubscriptionId`, `razorpaySubscriptionId`).
6. **Zero Impact on Existing E-Commerce / Product Tiers**: Existing `Subscription` and `ProductTier` models remain untouched, ensuring all existing product purchases and service page orders continue without interruption.

---

## 8. Migration Plan

When ready to apply:
1. Append the enums and model blocks to `prisma/schema.prisma`.
2. Update `User` and `ServiceCategory` with the corresponding relation fields.
3. Execute `npx prisma format` to verify formatting.
4. Run `npx prisma migrate dev --name add_subscription_billing_center` to create database tables.
