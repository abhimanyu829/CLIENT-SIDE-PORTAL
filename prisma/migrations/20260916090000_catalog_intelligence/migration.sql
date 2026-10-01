-- Catalog intelligence (upstream scraping pipeline) — additive only.
-- Six new isolated tables; NO changes to existing tables. The only link to
-- the rest of the schema is the nullable, unique CatalogCanonicalProduct.productId
-- (FK to Product, ON DELETE SET NULL).
--
-- Idempotent (known-issue fix after Phase 15). The original version created
-- an index on "CatalogSource" before the table existed, so it could not run
-- on any database and blocked every later migration in `prisma migrate
-- deploy`. Databases that already have these tables (created outside the
-- migration history) get a no-op here; a fresh database gets the tables.
-- None of the six tables is modelled in schema.prisma yet and no code uses
-- them; nothing in the agent gateway depends on them.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CatalogSource" (
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
CREATE TABLE IF NOT EXISTS "CatalogCrawlRun" (
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
CREATE TABLE IF NOT EXISTS "CatalogCrawlSource" (
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
CREATE TABLE IF NOT EXISTS "CatalogSourceRecord" (
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
CREATE TABLE IF NOT EXISTS "CatalogCanonicalProduct" (
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
CREATE TABLE IF NOT EXISTS "CatalogCrawlError" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogSource_key_key" ON "CatalogSource"("key");
CREATE INDEX IF NOT EXISTS "CatalogSource_group_idx" ON "CatalogSource"("group");
CREATE INDEX IF NOT EXISTS "CatalogSource_crawlPolicy_isActive_idx" ON "CatalogSource"("crawlPolicy", "isActive");

CREATE INDEX IF NOT EXISTS "CatalogCrawlRun_status_createdAt_idx" ON "CatalogCrawlRun"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "CatalogCrawlSource_crawlRunId_idx" ON "CatalogCrawlSource"("crawlRunId");
CREATE INDEX IF NOT EXISTS "CatalogCrawlSource_sourceId_idx" ON "CatalogCrawlSource"("sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "CatalogSourceRecord_sourceId_sourceUrl_key" ON "CatalogSourceRecord"("sourceId", "sourceUrl");
CREATE INDEX IF NOT EXISTS "CatalogSourceRecord_sourceId_status_idx" ON "CatalogSourceRecord"("sourceId", "status");
CREATE INDEX IF NOT EXISTS "CatalogSourceRecord_canonicalId_idx" ON "CatalogSourceRecord"("canonicalId");
CREATE INDEX IF NOT EXISTS "CatalogSourceRecord_contentHash_idx" ON "CatalogSourceRecord"("contentHash");
CREATE INDEX IF NOT EXISTS "CatalogSourceRecord_lastSeenAt_idx" ON "CatalogSourceRecord"("lastSeenAt");

CREATE INDEX IF NOT EXISTS "CatalogCanonicalProduct_normalizedName_idx" ON "CatalogCanonicalProduct"("normalizedName");
CREATE INDEX IF NOT EXISTS "CatalogCanonicalProduct_category_opportunityScore_idx" ON "CatalogCanonicalProduct"("category", "opportunityScore");
CREATE INDEX IF NOT EXISTS "CatalogCanonicalProduct_reviewState_idx" ON "CatalogCanonicalProduct"("reviewState");
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogCanonicalProduct_productId_key" ON "CatalogCanonicalProduct"("productId");

CREATE INDEX IF NOT EXISTS "CatalogCrawlError_crawlRunId_errorType_idx" ON "CatalogCrawlError"("crawlRunId", "errorType");
CREATE INDEX IF NOT EXISTS "CatalogCrawlError_errorType_idx" ON "CatalogCrawlError"("errorType");

-- AddForeignKey (only where the constraint does not exist yet)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogCrawlSource_crawlRunId_fkey' AND conrelid = '"CatalogCrawlSource"'::regclass) THEN
        ALTER TABLE "CatalogCrawlSource" ADD CONSTRAINT "CatalogCrawlSource_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CatalogCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogCrawlSource_sourceId_fkey' AND conrelid = '"CatalogCrawlSource"'::regclass) THEN
        ALTER TABLE "CatalogCrawlSource" ADD CONSTRAINT "CatalogCrawlSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogSourceRecord_sourceId_fkey' AND conrelid = '"CatalogSourceRecord"'::regclass) THEN
        ALTER TABLE "CatalogSourceRecord" ADD CONSTRAINT "CatalogSourceRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogSourceRecord_crawlRunId_fkey' AND conrelid = '"CatalogSourceRecord"'::regclass) THEN
        ALTER TABLE "CatalogSourceRecord" ADD CONSTRAINT "CatalogSourceRecord_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CatalogCrawlRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogSourceRecord_canonicalId_fkey' AND conrelid = '"CatalogSourceRecord"'::regclass) THEN
        ALTER TABLE "CatalogSourceRecord" ADD CONSTRAINT "CatalogSourceRecord_canonicalId_fkey" FOREIGN KEY ("canonicalId") REFERENCES "CatalogCanonicalProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogCanonicalProduct_productId_fkey' AND conrelid = '"CatalogCanonicalProduct"'::regclass) THEN
        ALTER TABLE "CatalogCanonicalProduct" ADD CONSTRAINT "CatalogCanonicalProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogCrawlError_crawlRunId_fkey' AND conrelid = '"CatalogCrawlError"'::regclass) THEN
        ALTER TABLE "CatalogCrawlError" ADD CONSTRAINT "CatalogCrawlError_crawlRunId_fkey" FOREIGN KEY ("crawlRunId") REFERENCES "CatalogCrawlRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CatalogCrawlError_sourceId_fkey' AND conrelid = '"CatalogCrawlError"'::regclass) THEN
        ALTER TABLE "CatalogCrawlError" ADD CONSTRAINT "CatalogCrawlError_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
