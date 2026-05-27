import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const sql = String.raw`
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VENDOR';

ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'TEMPLATE';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'PLUGIN';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'PROMPT';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'WORKFLOW';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'CLOUD_SERVICE';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'SUPPORT_PLAN';
ALTER TYPE "ProductType" ADD VALUE IF NOT EXISTS 'CONSULTING';

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'AUTHORIZED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_REFUNDED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';

ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'PAYPAL';
ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'CRYPTO';
ALTER TYPE "PaymentGateway" ADD VALUE IF NOT EXISTS 'MANUAL';

ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'ORDER';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'VENDOR';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'AI_USAGE';
ALTER TYPE "NotifType" ADD VALUE IF NOT EXISTS 'COMMERCE';

DO $$ BEGIN
  CREATE TYPE "VendorStatus" AS ENUM ('PENDING', 'VERIFIED', 'SUSPENDED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VendorType" AS ENUM ('SAAS_CREATOR', 'AI_DEVELOPER', 'AUTOMATION_BUILDER', 'AGENCY', 'ENTERPRISE_SELLER', 'FREELANCER', 'API_PROVIDER', 'CONSULTANT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'ABANDONED', 'CONVERTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'PROCESSING', 'FULFILLED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FulfillmentType" AS ENUM ('HOSTED', 'DOWNLOAD', 'API_ACCESS', 'SERVICE_DELIVERY', 'ENTERPRISE_ONBOARDING');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'HELD');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceEngagementStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'ACTIVE', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'FUNDED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'RELEASED', 'DISPUTED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentDeploymentStatus" AS ENUM ('QUEUED', 'DEPLOYING', 'LIVE', 'FAILED', 'PAUSED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MetricEventType" AS ENUM ('VIEW', 'SEARCH', 'CART_ADD', 'CHECKOUT_STARTED', 'PURCHASE', 'SUBSCRIPTION_CREATED', 'AI_USAGE', 'API_CALL', 'REVIEW_CREATED', 'TICKET_CREATED', 'DEPLOYMENT_EVENT');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "VendorProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "displayName" TEXT NOT NULL,
  "legalName" TEXT,
  "type" "VendorType" NOT NULL,
  "status" "VendorStatus" NOT NULL DEFAULT 'PENDING',
  "headline" TEXT,
  "description" TEXT,
  "websiteUrl" TEXT,
  "supportEmail" TEXT,
  "logoUrl" TEXT,
  "coverUrl" TEXT,
  "badges" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "verificationNotes" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "sellerScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rankingScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "totalSales" INTEGER NOT NULL DEFAULT 0,
  "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  "payoutSettings" JSONB NOT NULL DEFAULT '{}',
  "analyticsSnapshot" JSONB NOT NULL DEFAULT '{}',
  "onboardingState" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "vendorId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "faqs" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "documentation" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "setupGuide" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "integrationCatalog" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "roadmap" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "changelog" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "supportPlans" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "bundleOffers" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "commerceConfig" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "aiConfig" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "ProductTier" ADD COLUMN IF NOT EXISTS "regionalPrices" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ProductTier" ADD COLUMN IF NOT EXISTS "entitlementRules" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ProductTier" ADD COLUMN IF NOT EXISTS "aiQuota" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "ProductTier" ADD COLUMN IF NOT EXISTS "supportLevel" TEXT;
ALTER TABLE "ProductTier" ADD COLUMN IF NOT EXISTS "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'HOSTED';

CREATE TABLE IF NOT EXISTS "Cart" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT,
  "sessionId" TEXT,
  "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "region" TEXT,
  "couponCode" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "abandonedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CartItem" (
  "id" TEXT PRIMARY KEY,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "tierId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "itemType" "ProductType" NOT NULL,
  "vendorId" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("cartId", "productId", "tierId")
);

CREATE TABLE IF NOT EXISTS "Order" (
  "id" TEXT PRIMARY KEY,
  "orderNumber" TEXT NOT NULL UNIQUE,
  "userId" TEXT NOT NULL,
  "cartId" TEXT UNIQUE,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "gateway" "PaymentGateway",
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "region" TEXT,
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "discountTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendorNetTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "couponCode" TEXT,
  "affiliateCode" TEXT,
  "referralCode" TEXT,
  "billingSnapshot" JSONB NOT NULL DEFAULT '{}',
  "fulfillmentPlan" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "paidAt" TIMESTAMP(3),
  "fulfilledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "OrderItem" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "tierId" TEXT,
  "vendorId" TEXT,
  "name" TEXT NOT NULL,
  "itemType" "ProductType" NOT NULL,
  "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'HOSTED',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "vendorNetAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "entitlementConfig" JSONB NOT NULL DEFAULT '{}',
  "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "orderId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "orderId" TEXT;

CREATE TABLE IF NOT EXISTS "CustomerEntitlement" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "orderId" TEXT,
  "subscriptionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "accessType" "FulfillmentType" NOT NULL,
  "quota" JSONB NOT NULL DEFAULT '{}',
  "usage" JSONB NOT NULL DEFAULT '{}',
  "apiKeyPrefix" TEXT,
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "VendorPayout" (
  "id" TEXT PRIMARY KEY,
  "vendorId" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "processor" TEXT,
  "processorRef" TEXT,
  "orderItemIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "approvedBy" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AffiliateReferral" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "ownerUserId" TEXT,
  "vendorId" TEXT,
  "orderId" TEXT,
  "commissionRate" DECIMAL(5,2) NOT NULL DEFAULT 10.00,
  "commissionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ServiceEngagement" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT,
  "vendorId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "ServiceEngagementStatus" NOT NULL DEFAULT 'PROPOSED',
  "budget" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "proposal" JSONB NOT NULL DEFAULT '{}',
  "agreement" JSONB NOT NULL DEFAULT '{}',
  "schedule" JSONB NOT NULL DEFAULT '{}',
  "escrowBalance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "startsAt" TIMESTAMP(3),
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ServiceMilestone" (
  "id" TEXT PRIMARY KEY,
  "engagementId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
  "dueAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  "deliverables" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AgentDeployment" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AgentDeploymentStatus" NOT NULL DEFAULT 'QUEUED',
  "runtimeProvider" TEXT,
  "model" TEXT,
  "endpointUrl" TEXT,
  "memoryConfig" JSONB NOT NULL DEFAULT '{}',
  "toolConfig" JSONB NOT NULL DEFAULT '{}',
  "usageSnapshot" JSONB NOT NULL DEFAULT '{}',
  "costSnapshot" JSONB NOT NULL DEFAULT '{}',
  "lastHeartbeatAt" TIMESTAMP(3),
  "deployedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PlatformMetricEvent" (
  "id" TEXT PRIMARY KEY,
  "type" "MetricEventType" NOT NULL,
  "userId" TEXT,
  "productId" TEXT,
  "orderId" TEXT,
  "vendorId" TEXT,
  "sessionId" TEXT,
  "source" TEXT,
  "value" DECIMAL(12,4),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Product_vendorId_idx" ON "Product"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorProfile_userId_idx" ON "VendorProfile"("userId");
CREATE INDEX IF NOT EXISTS "VendorProfile_status_type_idx" ON "VendorProfile"("status", "type");
CREATE INDEX IF NOT EXISTS "Cart_userId_status_idx" ON "Cart"("userId", "status");
CREATE INDEX IF NOT EXISTS "Order_userId_idx" ON "Order"("userId");
CREATE INDEX IF NOT EXISTS "Order_status_idx" ON "Order"("status");
CREATE INDEX IF NOT EXISTS "PlatformMetricEvent_type_occurredAt_idx" ON "PlatformMetricEvent"("type", "occurredAt");
`

function splitSqlStatements(input: string) {
  const statements: string[] = []
  let current = ""
  let inDollarQuote = false

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const pair = input.slice(index, index + 2)

    if (pair === "$$") {
      inDollarQuote = !inDollarQuote
      current += pair
      index += 1
      continue
    }

    if (char === ";" && !inDollarQuote) {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ""
      continue
    }

    current += char
  }

  const finalStatement = current.trim()
  if (finalStatement) statements.push(finalStatement)
  return statements
}

async function main() {
  const statements = splitSqlStatements(sql)
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    console.log("Enterprise schema sync completed.")
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
