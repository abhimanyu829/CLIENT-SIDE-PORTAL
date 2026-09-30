-- Abhibhi Agent Gateway — Phase 7 additive migration.
-- Hand-curated (not a raw `prisma migrate diff` dump) for the same reason as
-- the Phase 2 and Phase 6 migrations: the live database has out-of-scope
-- drift (legacy Catalog* tables) that must not be touched. Contains ONLY the
-- Phase 7 autonomy/approval objects. No existing table or column is altered.

-- CreateEnum
CREATE TYPE "AgentAutonomyLevel" AS ENUM ('OBSERVE_ONLY', 'ASSISTED', 'APPROVAL_REQUIRED', 'LIMITED_AUTONOMY', 'FULL_SCOPED_AUTONOMY');

-- CreateEnum
CREATE TYPE "AgentAutonomyPolicyStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AgentApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'CONSUMED');

-- CreateEnum
CREATE TYPE "AgentApprovalDecisionKind" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "AgentAutonomyPolicy" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AgentAutonomyPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "autonomyLevel" "AgentAutonomyLevel" NOT NULL,
    "maxRiskTier" TEXT NOT NULL,
    "allowedCapabilityIds" TEXT[],
    "approvalRequiredFor" TEXT[],
    "environmentScope" TEXT[],
    "resourceScopeReference" TEXT,
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "AgentAutonomyPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentApprovalRequest" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "agentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "capabilityId" TEXT NOT NULL,
    "capabilityVersion" INTEGER NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "environment" TEXT NOT NULL,
    "riskTier" TEXT NOT NULL,
    "autonomyLevel" "AgentAutonomyLevel" NOT NULL,
    "autonomyPolicyVersion" INTEGER,
    "authorizationPolicyRef" TEXT,
    "inputDigest" TEXT NOT NULL,
    "bindingDigest" TEXT NOT NULL,
    "activeBindingKey" TEXT,
    "status" "AgentApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requiredApproverScope" TEXT NOT NULL,
    "approvalMethod" TEXT NOT NULL,
    "displaySummary" JSONB NOT NULL,
    "stepUpCodeHash" TEXT,
    "stepUpApproverId" TEXT,
    "stepUpExpiresAt" TIMESTAMP(3),
    "stepUpAttempts" INTEGER NOT NULL DEFAULT 0,
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "AgentApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentApprovalDecision" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "decision" "AgentApprovalDecisionKind" NOT NULL,
    "approverUserId" TEXT NOT NULL,
    "approverRole" TEXT NOT NULL,
    "approverSessionRef" TEXT NOT NULL,
    "approvalMethod" TEXT NOT NULL,
    "decisionVersion" INTEGER NOT NULL DEFAULT 1,
    "scopeDigest" TEXT NOT NULL,
    "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentApprovalDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentAutonomyPolicy_connectionId_version_key" ON "AgentAutonomyPolicy"("connectionId", "version");

-- CreateIndex
CREATE INDEX "AgentAutonomyPolicy_connectionId_status_idx" ON "AgentAutonomyPolicy"("connectionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentApprovalRequest_publicRef_key" ON "AgentApprovalRequest"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "AgentApprovalRequest_activeBindingKey_key" ON "AgentApprovalRequest"("activeBindingKey");

-- CreateIndex
CREATE INDEX "AgentApprovalRequest_connectionId_status_idx" ON "AgentApprovalRequest"("connectionId", "status");

-- CreateIndex
CREATE INDEX "AgentApprovalRequest_status_expiresAt_idx" ON "AgentApprovalRequest"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AgentApprovalRequest_ownerId_idx" ON "AgentApprovalRequest"("ownerId");

-- CreateIndex
CREATE INDEX "AgentApprovalRequest_bindingDigest_idx" ON "AgentApprovalRequest"("bindingDigest");

-- CreateIndex
CREATE UNIQUE INDEX "AgentApprovalDecision_approvalRequestId_key" ON "AgentApprovalDecision"("approvalRequestId");

-- CreateIndex
CREATE INDEX "AgentApprovalDecision_approverUserId_idx" ON "AgentApprovalDecision"("approverUserId");

-- AddForeignKey
ALTER TABLE "AgentAutonomyPolicy" ADD CONSTRAINT "AgentAutonomyPolicy_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentAutonomyPolicy" ADD CONSTRAINT "AgentAutonomyPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApprovalRequest" ADD CONSTRAINT "AgentApprovalRequest_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApprovalDecision" ADD CONSTRAINT "AgentApprovalDecision_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "AgentApprovalRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentApprovalDecision" ADD CONSTRAINT "AgentApprovalDecision_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
