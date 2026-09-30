-- Catalog intelligence (upstream scraping pipeline) — additive only.
-- Five new isolated models; NO changes to existing tables except one new
-- nullable unique column on Product (catalogCanonical back-relation lives on
-- CatalogCanonicalProduct.productId, so this migration only ADDS tables).

-- CreateIndex
CREATE INDEX "CatalogSource_group_idx" ON "CatalogSource"("group");

-- CreateTable
CREATE TABLE "CatalogSource" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "crawlPolicy" TEXT NOT NULL DEFAULT 'APPROVED',
    "policyReason" TEXT,
    "accessMethod" TEXT NOT NULL DEFAULT 'HTML',
    "baseUrl" TEXT,
    "rateLimitMs" INTEGER NOT NULL DEFAULT 2000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCrawlRun" (
    "id" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "startedBy" TEXT,
    "report" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCrawlRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCrawlSource" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "pagesDiscovered" INTEGER NOT NULL DEFAULT 0,
    "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
    "newRecords" INTEGER NOT NULL DEFAULT 0,
    "updatedRecords" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CatalogCrawlSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSourceRecord" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "officialUrl" TEXT,
    "crawlRunId" TEXT,
    "canonicalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RAW',
    "rawPayload" JSONB NOT NULL DEFAULT '{}',
    "normalizedPayload" JSONB NOT NULL DEFAULT '{}',
    "contentHash" TEXT,
    "pricingHash" TEXT,
    "featureHash" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3),
    "changeFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "fieldsVerified" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "confidence" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCanonicalProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "provider" TEXT,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "classificationConfidence" INTEGER NOT NULL DEFAULT 0,
    "intelligence" JSONB NOT NULL DEFAULT '{}',
    "suggestedTagline" TEXT,
    "suggestedDescription" TEXT,
    "canProvideAsService" BOOLEAN NOT NULL DEFAULT false,
    "canCustomize" BOOLEAN NOT NULL DEFAULT false,
    "canBuildOriginalEquivalent" BOOLEAN NOT NULL DEFAULT false,
    "potentialSaaS" BOOLEAN NOT NULL DEFAULT false,
    "potentialAIAgent" BOOLEAN NOT NULL DEFAULT false,
    "potentialAutomation" BOOLEAN NOT NULL DEFAULT false,
    "targetCustomer" TEXT,
    "implementationComplexity" TEXT,
    "estimatedBusinessValue" TEXT,
    "opportunityScore" INTEGER NOT NULL DEFAULT 0,
    "opportunityFactors" JSONB NOT NULL DEFAULT '{}',
    "reviewState" TEXT NOT NULL DEFAULT 'NEW',
    "productId" TEXT,
    "adminOverrides" JSONB NOT NULL DEFAULT '{}',
    "dedupeStatus" TEXT NOT NULL DEFAULT 'CANONICAL',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCanonicalProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogCrawlError" (
    "id" TEXT NOT NULL,
    "crawlRunId" TEXT NOT NULL,
    "sourceId" TEXT,
    "url" TEXT,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogCrawlError_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogSource_key_key" ON "CatalogSource"("key");
CREATE INDEX "CatalogSource_group_idx" ON "CatalogSource"("group");
CREATE INDEX "CatalogSource_crawlPolicy_isActive_idx" ON "CatalogSource"("crawlPolicy", "isActive");

CREATE INDEX "CatalogCrawlRun_status_createdAt_idx" ON "CatalogCrawlRun"("status", "createdAt");

CREATE INDEX "CatalogCrawlSource_crawlRunId_idx" ON "CatalogCrawlSource"("crawlRunId");
CREATE INDEX "CatalogCrawlSource_sourceId_idx" ON "CatalogCrawlSource"("sourceId");

CREATE UNIQUE INDEX "CatalogSourceRecord_sourceId_sourceUrl_key" ON "CatalogSourceRecord"("sourceId", "sourceUrl");
CREATE INDEX "CatalogSourceRecord_sourceId_status_idx" ON "CatalogSourceRecord"("sourceId", "status");
CREATE INDEX "CatalogSourceRecord_canonicalId_idx" ON "CatalogSourceRecord"("canonicalId");
CREATE INDEX "CatalogSourceRecord_contentHash_idx" ON "CatalogSourceRecord"("contentHash");
CREATE INDEX "CatalogSourceRecord_lastSeenAt_idx" ON "CatalogSourceRecord"("lastSeenAt");

CREATE INDEX "CatalogCanonicalProduct_normalizedName_idx" ON "CatalogCanonicalProduct"("normalizedName");
CREATE INDEX "CatalogCanonicalProduct_category_opportunityScore_idx" ON "CatalogCanonicalProduct"("category", "opportunityScore");
CREATE INDEX "CatalogCanonicalProduct_reviewState_idx" ON "CatalogCanonicalProduct"("reviewState");
CREATE UNIQUE INDEX "CatalogCanonicalProduct_productId_key" ON "CatalogCanonicalProduct"("productId");

CREATE INDEX "CatalogCrawlError_crawlRunId_errorType_idx" ON "CatalogCrawlError"("crawlRunId", "errorType");
CREATE INDEX "CatalogCrawlError_errorType_idx" ON "CatalogCrawlError"("errorType");

-- AddForeignKey
ALTER TABLE "CatalogCrawlSource" ADD CONSTRAINT "CatalogCrawlSource_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CatalogCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogCrawlSource" ADD CONSTRAINT "CatalogCrawlSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogSourceRecord" ADD CONSTRAINT "CatalogSourceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CatalogSourceRecord" ADD CONSTRAINT "CatalogSourceRecord_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CatalogCrawlRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogSourceRecord" ADD CONSTRAINT "CatalogSourceRecord_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "CatalogCanonicalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogCanonicalProduct" ADD CONSTRAINT "CatalogCanonicalProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CatalogCrawlError" ADD CONSTRAINT "CatalogCrawlError_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CatalogCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogCrawlError" ADD CONSTRAINT "CatalogCrawlError_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
