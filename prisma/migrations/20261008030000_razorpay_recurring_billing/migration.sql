-- Phase 4 — Razorpay recurring billing
-- STRICTLY ADDITIVE. No existing table/column/index/constraint is dropped or
-- altered, and no standalone commerce or plan-catalog or entitlement table is
-- touched. The existing one-time Razorpay flow is untouched by this migration.
--
-- NOTE: the live database also contains legacy `Catalog*` tables not declared
-- in schema.prisma (pre-existing drift). This migration deliberately does not
-- touch them.

-- CreateEnum
CREATE TYPE "PlanMappingStatus" AS ENUM ('ACTIVE', 'NEEDS_RECONCILIATION', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SubscriptionChargeStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'PENDING', 'REFUNDED');

-- CreateTable
CREATE TABLE "RazorpayPlanMapping" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "razorpayPlanId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountSubunits" INTEGER NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "billingInterval" INTEGER NOT NULL,
    "totalCount" INTEGER,
    "mappingStatus" "PlanMappingStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RazorpayPlanMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "razorpaySubscriptionId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpayInvoiceId" TEXT,
    "amountSubunits" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "chargeStatus" "SubscriptionChargeStatus" NOT NULL DEFAULT 'PENDING',
    "providerEventId" TEXT,
    "billingPeriodStart" TIMESTAMP(3),
    "billingPeriodEnd" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayPlanMapping_razorpayPlanId_key" ON "RazorpayPlanMapping"("razorpayPlanId");

-- CreateIndex
CREATE INDEX "RazorpayPlanMapping_mappingStatus_idx" ON "RazorpayPlanMapping"("mappingStatus");

-- CreateIndex
CREATE INDEX "RazorpayPlanMapping_environment_idx" ON "RazorpayPlanMapping"("environment");

-- CreateIndex
CREATE INDEX "RazorpayPlanMapping_razorpayPlanId_idx" ON "RazorpayPlanMapping"("razorpayPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayPlanMapping_planVersionId_environment_key" ON "RazorpayPlanMapping"("planVersionId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_razorpayPaymentId_key" ON "SubscriptionCharge"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionCharge_providerEventId_key" ON "SubscriptionCharge"("providerEventId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_subscriptionId_chargeStatus_idx" ON "SubscriptionCharge"("subscriptionId", "chargeStatus");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_razorpaySubscriptionId_idx" ON "SubscriptionCharge"("razorpaySubscriptionId");

-- CreateIndex
CREATE INDEX "SubscriptionCharge_chargeStatus_idx" ON "SubscriptionCharge"("chargeStatus");

-- AddForeignKey
ALTER TABLE "RazorpayPlanMapping" ADD CONSTRAINT "RazorpayPlanMapping_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;