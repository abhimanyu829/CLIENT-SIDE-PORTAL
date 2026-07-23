CREATE TYPE "ServiceDiscoveryEventType" AS ENUM ('VIEW', 'CLICK', 'SEARCH', 'WISHLIST_SIGNAL', 'CART_SIGNAL', 'PURCHASE_SIGNAL');
CREATE TYPE "ServiceCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ARCHIVED', 'COMPLETED');
CREATE TYPE "ServiceCampaignEventType" AS ENUM ('IMPRESSION', 'CLICK', 'CONVERSION');

CREATE TABLE "ServiceDiscoveryTag" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceDiscoveryTag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceDiscoveryTagAssignment" (
  "servicePageId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceDiscoveryTagAssignment_pkey" PRIMARY KEY ("servicePageId", "tagId")
);

CREATE TABLE "ServiceDiscoveryCollection" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "placement" TEXT NOT NULL DEFAULT 'services',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "audience" JSONB NOT NULL DEFAULT '{}',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceDiscoveryCollection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceDiscoveryCollectionItem" (
  "collectionId" TEXT NOT NULL,
  "servicePageId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceDiscoveryCollectionItem_pkey" PRIMARY KEY ("collectionId", "servicePageId")
);

CREATE TABLE "ServiceDiscoveryCampaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "ServiceCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "placement" TEXT NOT NULL DEFAULT 'services',
  "bannerUrl" TEXT,
  "thumbnailUrl" TEXT,
  "backgroundUrl" TEXT,
  "videoUrl" TEXT,
  "ctaLabel" TEXT,
  "landingUrl" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 0,
  "targetAudience" JSONB NOT NULL DEFAULT '{}',
  "categorySlugs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "relatedServiceIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "relatedProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceDiscoveryCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceDiscoveryEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "sessionKey" TEXT,
  "servicePageId" TEXT,
  "eventType" "ServiceDiscoveryEventType" NOT NULL,
  "query" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceDiscoveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceInterestProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryScores" JSONB NOT NULL DEFAULT '{}',
  "tagScores" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceInterestProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceCampaignEvent" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT,
  "sessionKey" TEXT,
  "servicePageId" TEXT,
  "eventType" "ServiceCampaignEventType" NOT NULL,
  "value" DECIMAL(12,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceCampaignEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceDiscoveryTag_slug_key" ON "ServiceDiscoveryTag"("slug");
CREATE INDEX "ServiceDiscoveryTag_isFeatured_idx" ON "ServiceDiscoveryTag"("isFeatured");
CREATE INDEX "ServiceDiscoveryTagAssignment_tagId_idx" ON "ServiceDiscoveryTagAssignment"("tagId");
CREATE UNIQUE INDEX "ServiceDiscoveryCollection_slug_key" ON "ServiceDiscoveryCollection"("slug");
CREATE INDEX "ServiceDiscoveryCollection_placement_isActive_priority_idx" ON "ServiceDiscoveryCollection"("placement", "isActive", "priority");
CREATE INDEX "ServiceDiscoveryCollectionItem_servicePageId_idx" ON "ServiceDiscoveryCollectionItem"("servicePageId");
CREATE UNIQUE INDEX "ServiceDiscoveryCampaign_slug_key" ON "ServiceDiscoveryCampaign"("slug");
CREATE INDEX "ServiceDiscoveryCampaign_status_placement_priority_idx" ON "ServiceDiscoveryCampaign"("status", "placement", "priority");
CREATE INDEX "ServiceDiscoveryCampaign_startsAt_endsAt_idx" ON "ServiceDiscoveryCampaign"("startsAt", "endsAt");
CREATE INDEX "ServiceDiscoveryEvent_userId_occurredAt_idx" ON "ServiceDiscoveryEvent"("userId", "occurredAt");
CREATE INDEX "ServiceDiscoveryEvent_sessionKey_occurredAt_idx" ON "ServiceDiscoveryEvent"("sessionKey", "occurredAt");
CREATE INDEX "ServiceDiscoveryEvent_servicePageId_eventType_occurredAt_idx" ON "ServiceDiscoveryEvent"("servicePageId", "eventType", "occurredAt");
CREATE UNIQUE INDEX "ServiceInterestProfile_userId_key" ON "ServiceInterestProfile"("userId");
CREATE INDEX "ServiceCampaignEvent_campaignId_eventType_createdAt_idx" ON "ServiceCampaignEvent"("campaignId", "eventType", "createdAt");
CREATE INDEX "ServiceCampaignEvent_userId_createdAt_idx" ON "ServiceCampaignEvent"("userId", "createdAt");

ALTER TABLE "ServiceDiscoveryTagAssignment" ADD CONSTRAINT "ServiceDiscoveryTagAssignment_servicePageId_fkey" FOREIGN KEY ("servicePageId") REFERENCES "ServicePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDiscoveryTagAssignment" ADD CONSTRAINT "ServiceDiscoveryTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ServiceDiscoveryTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDiscoveryCollectionItem" ADD CONSTRAINT "ServiceDiscoveryCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "ServiceDiscoveryCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDiscoveryCollectionItem" ADD CONSTRAINT "ServiceDiscoveryCollectionItem_servicePageId_fkey" FOREIGN KEY ("servicePageId") REFERENCES "ServicePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceDiscoveryEvent" ADD CONSTRAINT "ServiceDiscoveryEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceDiscoveryEvent" ADD CONSTRAINT "ServiceDiscoveryEvent_servicePageId_fkey" FOREIGN KEY ("servicePageId") REFERENCES "ServicePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceInterestProfile" ADD CONSTRAINT "ServiceInterestProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCampaignEvent" ADD CONSTRAINT "ServiceCampaignEvent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ServiceDiscoveryCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceCampaignEvent" ADD CONSTRAINT "ServiceCampaignEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceCampaignEvent" ADD CONSTRAINT "ServiceCampaignEvent_servicePageId_fkey" FOREIGN KEY ("servicePageId") REFERENCES "ServicePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
