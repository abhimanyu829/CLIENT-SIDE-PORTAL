-- Phase 2 — Plan Catalog & Bundle Composition
-- STRICTLY ADDITIVE for the plan catalog domain. Existing SubscriptionPlan
-- rows stay valid: the new `status` column defaults to 'PUBLISHED' (legacy
-- plans are currently offered); all other new columns are nullable.
-- No existing table/column/index/constraint is dropped or altered, and no
-- standalone commerce (Cart/Order/Payment/Invoice/Product) table is touched.
--
-- NOTE: the live database also contains legacy `Catalog*` tables that are not
-- declared in schema.prisma (pre-existing drift, unrelated to Phase 2). This
-- migration deliberately does not touch them.

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'MONTHLY', 'THREE_MONTH', 'SIX_MONTH', 'YEARLY', 'ENTERPRISE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlanVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanItemType" AS ENUM ('PRODUCT', 'SERVICE', 'FEATURE', 'AI_CAPABILITY', 'STORAGE', 'USER_LIMIT', 'ADMIN_LIMIT', 'RESOURCE_LIMIT', 'SUPPORT');

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN     "billingIntervalMonths" INTEGER,
ADD COLUMN     "catalogRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentVersionId" TEXT,
ADD COLUMN     "durationMonths" INTEGER,
ADD COLUMN     "planType" "PlanType",
ADD COLUMN     "status" "PlanStatus" NOT NULL DEFAULT 'PUBLISHED';

-- CreateTable
CREATE TABLE "PlanVersion" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "PlanVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "price" DECIMAL(10,2),
    "currency" "PriceCurrency",
    "billingIntervalMonths" INTEGER,
    "durationMonths" INTEGER,
    "notes" TEXT,
    "createdBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planVersionId" TEXT NOT NULL,
    "itemType" "PlanItemType" NOT NULL,
    "itemRefKey" TEXT NOT NULL,
    "itemRefId" TEXT,
    "label" TEXT,
    "quantity" INTEGER DEFAULT 1,
    "limitValue" DECIMAL(18,4),
    "limitUnit" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanVersion_planId_status_idx" ON "PlanVersion"("planId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PlanVersion_planId_version_key" ON "PlanVersion"("planId", "version");

-- CreateIndex
CREATE INDEX "PlanItem_planVersionId_idx" ON "PlanItem"("planVersionId");

-- CreateIndex
CREATE INDEX "PlanItem_itemType_itemRefId_idx" ON "PlanItem"("itemType", "itemRefId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanItem_planVersionId_itemType_itemRefKey_key" ON "PlanItem"("planVersionId", "itemType", "itemRefKey");

-- CreateIndex
CREATE INDEX "SubscriptionPlan_status_planType_idx" ON "SubscriptionPlan"("status", "planType");

-- AddForeignKey
ALTER TABLE "PlanVersion" ADD CONSTRAINT "PlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planVersionId_fkey" FOREIGN KEY ("planVersionId") REFERENCES "PlanVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
