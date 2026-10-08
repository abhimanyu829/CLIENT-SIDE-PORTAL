-- Phase 3 — Entitlement Engine
-- STRICTLY ADDITIVE for the entitlement domain. No existing table/column/index
-- or constraint is dropped or altered, and no standalone commerce table
-- (Cart/Order/Payment/Invoice/Product/CustomerEntitlement) is touched. The
-- existing application remains fully functional with empty entitlement data.
--
-- NOTE: the live database also contains legacy `Catalog*` tables that are not
-- declared in schema.prisma (pre-existing drift, unrelated to Phase 3). This
-- migration deliberately does not touch them.

-- CreateEnum
CREATE TYPE "EntitlementType" AS ENUM ('PRODUCT', 'SERVICE', 'FEATURE', 'AI_CAPABILITY', 'STORAGE', 'USER_LIMIT', 'ADMIN_LIMIT', 'RESOURCE_LIMIT', 'SUPPORT');

-- CreateEnum
CREATE TYPE "EntitlementSourceType" AS ENUM ('STANDALONE_PURCHASE', 'SUBSCRIPTION', 'ADMIN_GRANT', 'PROMOTIONAL');

-- CreateEnum
CREATE TYPE "EntitlementScope" AS ENUM ('GLOBAL', 'OWNER', 'TEAM', 'RESOURCE');

-- CreateEnum
CREATE TYPE "GrantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EntitlementSubjectType" AS ENUM ('USER', 'TEAM');

-- CreateTable
CREATE TABLE "EntitlementDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "EntitlementType" NOT NULL,
    "resourceType" TEXT,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementGrant" (
    "id" TEXT NOT NULL,
    "entitlementDefinitionId" TEXT NOT NULL,
    "entitlementKey" TEXT NOT NULL,
    "subjectType" "EntitlementSubjectType" NOT NULL,
    "subjectUserId" TEXT,
    "subjectTeamId" TEXT,
    "sourceType" "EntitlementSourceType" NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "scope" "EntitlementScope" NOT NULL DEFAULT 'OWNER',
    "resourceType" TEXT,
    "resourceId" TEXT,
    "quantity" INTEGER,
    "limitValue" DECIMAL(18,4),
    "limitUnit" TEXT,
    "status" "GrantStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementDefinition_key_key" ON "EntitlementDefinition"("key");

-- CreateIndex
CREATE INDEX "EntitlementDefinition_type_isActive_idx" ON "EntitlementDefinition"("type", "isActive");

-- CreateIndex
CREATE INDEX "EntitlementDefinition_resourceType_idx" ON "EntitlementDefinition"("resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "EntitlementGrant_dedupeKey_key" ON "EntitlementGrant"("dedupeKey");

-- CreateIndex
CREATE INDEX "EntitlementGrant_entitlementKey_subjectUserId_status_idx" ON "EntitlementGrant"("entitlementKey", "subjectUserId", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_entitlementKey_subjectTeamId_status_idx" ON "EntitlementGrant"("entitlementKey", "subjectTeamId", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_subjectUserId_status_idx" ON "EntitlementGrant"("subjectUserId", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_subjectTeamId_status_idx" ON "EntitlementGrant"("subjectTeamId", "status");

-- CreateIndex
CREATE INDEX "EntitlementGrant_sourceType_sourceReference_idx" ON "EntitlementGrant"("sourceType", "sourceReference");

-- CreateIndex
CREATE INDEX "EntitlementGrant_resourceType_resourceId_idx" ON "EntitlementGrant"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "EntitlementGrant_expiresAt_idx" ON "EntitlementGrant"("expiresAt");

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_entitlementDefinitionId_fkey" FOREIGN KEY ("entitlementDefinitionId") REFERENCES "EntitlementDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementGrant" ADD CONSTRAINT "EntitlementGrant_subjectTeamId_fkey" FOREIGN KEY ("subjectTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
