-- Abhibhi Agent Gateway — Phase 6 additive migration.
-- Contains ONLY the new Agent Gateway policy-engine objects. Hand-curated
-- (not a raw `prisma migrate diff` dump) — the live database has other
-- out-of-scope drift (legacy Catalog* tables) that must not be touched by
-- this migration, matching the exact precedent set by
-- prisma/migrations/20260929000000_agent_gateway_phase2_identity/migration.sql.

-- CreateEnum
CREATE TYPE "AgentPolicyEffect" AS ENUM ('ALLOW', 'DENY', 'REQUIRES_APPROVAL');

-- CreateEnum
CREATE TYPE "AgentPolicyScope" AS ENUM ('GLOBAL', 'OWNER', 'TEAM', 'CONNECTION', 'CAPABILITY', 'RESOURCE_TYPE', 'RESOURCE', 'ENVIRONMENT');

-- CreateEnum
CREATE TYPE "AgentPolicyVersionStatus" AS ENUM ('ACTIVE', 'DISABLED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "AgentPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "currentVersionId" TEXT,

    CONSTRAINT "AgentPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentPolicyVersion" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "AgentPolicyVersionStatus" NOT NULL DEFAULT 'ACTIVE',
    "effect" "AgentPolicyEffect" NOT NULL,
    "scope" "AgentPolicyScope" NOT NULL,
    "scopeValue" TEXT,
    "capabilityId" TEXT,
    "conditions" JSONB,
    "riskConstraint" TEXT,
    "approvalRequirement" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "AgentPolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentPolicy_currentVersionId_key" ON "AgentPolicy"("currentVersionId");

-- CreateIndex
CREATE INDEX "AgentPolicy_enabled_idx" ON "AgentPolicy"("enabled");

-- CreateIndex
CREATE INDEX "AgentPolicy_priority_idx" ON "AgentPolicy"("priority");

-- CreateIndex
CREATE UNIQUE INDEX "AgentPolicyVersion_policyId_version_key" ON "AgentPolicyVersion"("policyId", "version");

-- CreateIndex
CREATE INDEX "AgentPolicyVersion_policyId_idx" ON "AgentPolicyVersion"("policyId");

-- CreateIndex
CREATE INDEX "AgentPolicyVersion_capabilityId_idx" ON "AgentPolicyVersion"("capabilityId");

-- CreateIndex
CREATE INDEX "AgentPolicyVersion_scope_idx" ON "AgentPolicyVersion"("scope");

-- CreateIndex
CREATE INDEX "AgentPolicyVersion_status_idx" ON "AgentPolicyVersion"("status");

-- AddForeignKey
ALTER TABLE "AgentPolicy" ADD CONSTRAINT "AgentPolicy_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPolicy" ADD CONSTRAINT "AgentPolicy_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AgentPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPolicyVersion" ADD CONSTRAINT "AgentPolicyVersion_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AgentPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentPolicyVersion" ADD CONSTRAINT "AgentPolicyVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
