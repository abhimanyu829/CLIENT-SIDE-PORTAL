-- Phase 5 — Subscription-to-entitlement provisioning
-- STRICTLY ADDITIVE. No existing table/column/index/constraint is dropped or
-- altered. No standalone commerce, plan-catalog, entitlement or billing table
-- is touched. Legacy Catalog* drift tables are deliberately excluded.

-- CreateEnum
CREATE TYPE "ProvisioningOperation" AS ENUM ('INITIAL_ACTIVATION', 'SUCCESSFUL_RENEWAL', 'PERIOD_EXTENSION', 'CANCELLATION_UPDATE', 'PAUSE_UPDATE', 'RESUME_UPDATE', 'PAYMENT_HALT_UPDATE', 'EXPIRATION', 'ACCESS_REVOCATION');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED_RETRYABLE', 'FAILED_PERMANENT');

-- CreateTable
CREATE TABLE "SubscriptionProvisioning" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "operation" "ProvisioningOperation" NOT NULL,
    "status" "ProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "planVersionId" TEXT,
    "periodRef" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "grantCount" INTEGER NOT NULL DEFAULT 0,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionProvisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionProvisioning_dedupeKey_key" ON "SubscriptionProvisioning"("dedupeKey");

-- CreateIndex
CREATE INDEX "SubscriptionProvisioning_subscriptionId_status_idx" ON "SubscriptionProvisioning"("subscriptionId", "status");

-- CreateIndex
CREATE INDEX "SubscriptionProvisioning_status_attemptCount_idx" ON "SubscriptionProvisioning"("status", "attemptCount");

-- CreateIndex
CREATE INDEX "SubscriptionProvisioning_operation_idx" ON "SubscriptionProvisioning"("operation");

-- AddForeignKey
ALTER TABLE "SubscriptionProvisioning" ADD CONSTRAINT "SubscriptionProvisioning_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "UserSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;