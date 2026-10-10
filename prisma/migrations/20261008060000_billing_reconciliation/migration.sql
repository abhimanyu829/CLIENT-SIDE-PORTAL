-- Phase 10 — Billing reconciliation & production hardening
-- STRICTLY ADDITIVE. No existing table/column/index/constraint is dropped or
-- altered. Legacy Catalog* drift tables deliberately excluded.

-- CreateEnum
CREATE TYPE "ReconciliationMode" AS ENUM ('DETECT_ONLY', 'DRY_RUN', 'SAFE_AUTO_REPAIR', 'APPROVED_REPAIR', 'MANUAL_INVESTIGATION');

-- CreateEnum
CREATE TYPE "ReconciliationRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReconciliationFindingStatus" AS ENUM ('NEW', 'ACTION_PROPOSED', 'REPAIR_IN_PROGRESS', 'RESOLVED', 'NOT_REPAIRED', 'FAILED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ReconciliationSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ReconciliationCategory" AS ENUM ('UNPROCESSED_EVENT', 'MISSING_PROVIDER_EVIDENCE', 'AMOUNT_OR_CURRENCY_MISMATCH', 'DUPLICATE_RECORD', 'STALE_SUBSCRIPTION_STATE', 'FAILED_PROVISIONING', 'ENTITLEMENT_MISMATCH', 'INVOICE_MISMATCH', 'INSUFFICIENT_EVIDENCE', 'EXTERNAL_PROVIDER_UNAVAILABLE', 'UNEXPECTED_INTERNAL_STATE');

-- CreateTable
CREATE TABLE "ReconciliationRun" (
    "id" TEXT NOT NULL,
    "mode" "ReconciliationMode" NOT NULL,
    "status" "ReconciliationRunStatus" NOT NULL DEFAULT 'RUNNING',
    "scope" TEXT,
    "actorId" TEXT NOT NULL,
    "correlationId" TEXT,
    "scanned" INTEGER NOT NULL DEFAULT 0,
    "findingsCount" INTEGER NOT NULL DEFAULT 0,
    "repairedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationFinding" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "findingKey" TEXT NOT NULL,
    "category" "ReconciliationCategory" NOT NULL,
    "severity" "ReconciliationSeverity" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "expectedValue" JSONB,
    "observedValue" JSONB,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "proposedAction" TEXT,
    "actionStatus" TEXT,
    "status" "ReconciliationFindingStatus" NOT NULL DEFAULT 'NEW',
    "resolutionNote" TEXT,
    "repairOperationRef" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "firstObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconciliationFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReconciliationRun_status_startedAt_idx" ON "ReconciliationRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ReconciliationRun_mode_idx" ON "ReconciliationRun"("mode");

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationFinding_findingKey_key" ON "ReconciliationFinding"("findingKey");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_status_severity_idx" ON "ReconciliationFinding"("status", "severity");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_category_status_idx" ON "ReconciliationFinding"("category", "status");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_entityType_entityId_idx" ON "ReconciliationFinding"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ReconciliationFinding_lastObservedAt_idx" ON "ReconciliationFinding"("lastObservedAt");

-- AddForeignKey
ALTER TABLE "ReconciliationFinding" ADD CONSTRAINT "ReconciliationFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;