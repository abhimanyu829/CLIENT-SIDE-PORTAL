-- Phase 6 — Free Forever + 14-day trial engine
-- STRICTLY ADDITIVE (the two enum-value adds are backward-compatible Postgres
-- ALTER TYPE ADD VALUE). No existing table/column/index/constraint is dropped
-- or altered. No commerce/plan/entitlement/billing table is touched. Legacy
-- Catalog* drift tables are deliberately excluded.

-- AlterEnum (Source enum gains the Phase-6 grant origins)
ALTER TYPE "EntitlementSourceType" ADD VALUE 'FREE_PLAN';
ALTER TYPE "EntitlementSourceType" ADD VALUE 'TRIAL';

-- CreateEnum
CREATE TYPE "TrialStatus" AS ENUM ('PENDING', 'ACTIVE', 'CONVERTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FreeEnrollmentStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "TrialEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "trialScopeKey" TEXT NOT NULL,
    "status" "TrialStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "provisioningError" TEXT,
    "environment" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrialEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "status" "FreeEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "environment" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrialEnrollment_trialScopeKey_key" ON "TrialEnrollment"("trialScopeKey");

-- CreateIndex
CREATE INDEX "TrialEnrollment_userId_status_idx" ON "TrialEnrollment"("userId", "status");

-- CreateIndex
CREATE INDEX "TrialEnrollment_planVersionId_idx" ON "TrialEnrollment"("planVersionId");

-- CreateIndex
CREATE INDEX "TrialEnrollment_status_expiresAt_idx" ON "TrialEnrollment"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "FreeEnrollment_dedupeKey_key" ON "FreeEnrollment"("dedupeKey");

-- CreateIndex
CREATE INDEX "FreeEnrollment_userId_status_idx" ON "FreeEnrollment"("userId", "status");

-- CreateIndex
CREATE INDEX "FreeEnrollment_planVersionId_idx" ON "FreeEnrollment"("planVersionId");

-- AddForeignKey
ALTER TABLE "TrialEnrollment" ADD CONSTRAINT "TrialEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeEnrollment" ADD CONSTRAINT "FreeEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;