-- Abhibhi Agent Gateway — Phase 9 additive migration (event / webhook /
-- schedule triggers). Hand-curated for the same reason as the Phase 2/6/7/8
-- migrations (out-of-scope Catalog* drift on the live database). Creates the
-- trigger tables and adds ONE nullable column (plus FK and index) to the
-- Phase 8 "AgentTask" table. No other existing object is altered.
-- Apply after 20261002000000 (Phase 8).
-- CreateEnum
CREATE TYPE "AgentTriggerType" AS ENUM ('EVENT', 'WEBHOOK', 'SCHEDULE');
-- CreateEnum
CREATE TYPE "AgentTriggerStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'DISABLED', 'EXPIRED', 'REVOKED');
-- CreateEnum
CREATE TYPE "AgentTriggerConcurrency" AS ENUM ('ALLOW_PARALLEL', 'DROP_WHILE_RUNNING', 'QUEUE_ONE');
-- CreateEnum
CREATE TYPE "AgentTriggerMissedRunPolicy" AS ENUM ('SKIP', 'CATCH_UP_ONCE');
-- CreateEnum
CREATE TYPE "AgentTriggerRunStatus" AS ENUM ('TASK_CREATED', 'PENDING', 'DROPPED', 'DENIED', 'APPROVAL_REQUIRED', 'FAILED', 'SKIPPED_MISSED');
-- CreateTable
CREATE TABLE "AgentTrigger" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AgentTriggerType" NOT NULL,
    "status" "AgentTriggerStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "connectionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "environment" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "capabilityVersion" INTEGER NOT NULL,
    "input" JSONB NOT NULL,
    "bindResource" BOOLEAN NOT NULL DEFAULT false,
    "concurrency" "AgentTriggerConcurrency" NOT NULL DEFAULT 'DROP_WHILE_RUNNING',
    "eventType" TEXT,
    "eventResourceId" TEXT,
    "eventActorScope" TEXT,
    "webhookSecretRef" TEXT,
    "webhookSecretVersion" INTEGER,
    "scheduleKind" TEXT,
    "cronExpression" TEXT,
    "timezone" TEXT,
    "runAt" TIMESTAMP(3),
    "missedRunPolicy" "AgentTriggerMissedRunPolicy",
    "nextRunAt" TIMESTAMP(3),
    "lastScheduledFor" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastTriggeredAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentTrigger_pkey" PRIMARY KEY ("id"),
    -- Each type carries exactly its own configuration.
    CONSTRAINT "AgentTrigger_event_config_check" CHECK ("type" <> 'EVENT' OR ("eventType" IS NOT NULL AND "eventActorScope" IN ('OWNER', 'ANY'))),
    CONSTRAINT "AgentTrigger_webhook_config_check" CHECK ("type" <> 'WEBHOOK' OR "webhookSecretRef" IS NOT NULL),
    CONSTRAINT "AgentTrigger_schedule_config_check" CHECK ("type" <> 'SCHEDULE' OR ("scheduleKind" IN ('CRON', 'ONCE') AND "timezone" IS NOT NULL AND "missedRunPolicy" IS NOT NULL)),
    CONSTRAINT "AgentTrigger_version_check" CHECK ("version" >= 1),
    CONSTRAINT "AgentTrigger_failureCount_check" CHECK ("failureCount" >= 0)
);
-- CreateTable
CREATE TABLE "AgentTriggerRun" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "triggerId" TEXT NOT NULL,
    "deliveryKey" TEXT NOT NULL,
    "source" "AgentTriggerType" NOT NULL,
    "status" "AgentTriggerRunStatus" NOT NULL,
    "taskId" TEXT,
    "errorCode" TEXT,
    "resourceId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "bodyDigest" TEXT,
    "activeSlotKey" TEXT,
    "pendingSlotKey" TEXT,
    "activeSince" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "AgentTriggerRun_pkey" PRIMARY KEY ("id")
);
-- AlterTable (Phase 8 table): trigger that created the task.
ALTER TABLE "AgentTask" ADD COLUMN "triggerId" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "AgentTrigger_publicRef_key" ON "AgentTrigger"("publicRef");
-- CreateIndex
CREATE INDEX "AgentTrigger_type_status_idx" ON "AgentTrigger"("type", "status");
-- CreateIndex
CREATE INDEX "AgentTrigger_status_nextRunAt_idx" ON "AgentTrigger"("status", "nextRunAt");
-- CreateIndex
CREATE INDEX "AgentTrigger_eventType_status_idx" ON "AgentTrigger"("eventType", "status");
-- CreateIndex
CREATE INDEX "AgentTrigger_connectionId_idx" ON "AgentTrigger"("connectionId");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTriggerRun_publicRef_key" ON "AgentTriggerRun"("publicRef");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTriggerRun_taskId_key" ON "AgentTriggerRun"("taskId");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTriggerRun_activeSlotKey_key" ON "AgentTriggerRun"("activeSlotKey");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTriggerRun_pendingSlotKey_key" ON "AgentTriggerRun"("pendingSlotKey");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTriggerRun_triggerId_deliveryKey_key" ON "AgentTriggerRun"("triggerId", "deliveryKey");
-- CreateIndex
CREATE INDEX "AgentTriggerRun_triggerId_receivedAt_idx" ON "AgentTriggerRun"("triggerId", "receivedAt");
-- CreateIndex
CREATE INDEX "AgentTask_triggerId_idx" ON "AgentTask"("triggerId");
-- AddForeignKey
ALTER TABLE "AgentTrigger" ADD CONSTRAINT "AgentTrigger_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AgentTriggerRun" ADD CONSTRAINT "AgentTriggerRun_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "AgentTrigger"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_triggerId_fkey" FOREIGN KEY ("triggerId") REFERENCES "AgentTrigger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
