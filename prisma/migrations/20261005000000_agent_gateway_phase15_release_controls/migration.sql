-- Phase 15 — release controls: per-capability rollout stages and kill switches.
-- Additive only: two enums, two tables, indexes. No existing table is changed.

-- CreateEnum
CREATE TYPE "AgentRolloutStage" AS ENUM ('DISABLED', 'INTERNAL', 'CANARY', 'GENERAL', 'PAUSED');

-- CreateEnum
CREATE TYPE "AgentKillSwitchScope" AS ENUM ('GLOBAL', 'CAPABILITY', 'CONNECTION', 'RISK_TIER');

-- CreateTable
CREATE TABLE "AgentRollout" (
    "id" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "stage" "AgentRolloutStage" NOT NULL DEFAULT 'DISABLED',
    "canaryPercent" INTEGER NOT NULL DEFAULT 0,
    "allowedConnectionIds" TEXT[],
    "pausedFromStage" "AgentRolloutStage",
    "pausedReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRollout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentKillSwitch" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "scope" "AgentKillSwitchScope" NOT NULL,
    "target" TEXT,
    "environment" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "activatedById" TEXT NOT NULL,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "deactivationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentKillSwitch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentRollout_environment_stage_idx" ON "AgentRollout"("environment", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRollout_capabilityId_environment_key" ON "AgentRollout"("capabilityId", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "AgentKillSwitch_publicRef_key" ON "AgentKillSwitch"("publicRef");

-- CreateIndex
CREATE INDEX "AgentKillSwitch_environment_active_idx" ON "AgentKillSwitch"("environment", "active");

-- CreateIndex
CREATE INDEX "AgentKillSwitch_scope_target_idx" ON "AgentKillSwitch"("scope", "target");

