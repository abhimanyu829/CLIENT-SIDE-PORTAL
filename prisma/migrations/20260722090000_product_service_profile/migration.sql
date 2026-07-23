-- Product service details and plan information shown to purchased-product owners.
-- This is an optional extension table so existing products, checkout, orders,
-- subscriptions, and entitlements keep their current behavior.
CREATE TABLE "ProductServiceProfile" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "headline" TEXT,
    "summary" TEXT,
    "capacity" JSONB NOT NULL DEFAULT '{}',
    "freeServices" JSONB NOT NULL DEFAULT '[]',
    "paidAddons" JSONB NOT NULL DEFAULT '[]',
    "upgradePaths" JSONB NOT NULL DEFAULT '[]',
    "documentation" JSONB NOT NULL DEFAULT '[]',
    "tutorials" JSONB NOT NULL DEFAULT '[]',
    "supportBenefits" JSONB NOT NULL DEFAULT '[]',
    "hiddenFields" TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductServiceProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductServiceProfile_productId_key" ON "ProductServiceProfile"("productId");
CREATE INDEX "ProductServiceProfile_isPublished_idx" ON "ProductServiceProfile"("isPublished");
CREATE INDEX "ProductServiceProfile_updatedAt_idx" ON "ProductServiceProfile"("updatedAt");

ALTER TABLE "ProductServiceProfile"
ADD CONSTRAINT "ProductServiceProfile_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
