-- Abhibhi Agent Gateway — Phase 8 additive migration (async task engine).
-- Hand-curated for the same reason as the Phase 2/6/7 migrations: the live
-- database has out-of-scope drift (legacy Catalog* tables) that must not be
-- touched. Contains ONLY the Phase 8 AgentTask objects. No existing table or
-- column is altered. Must be applied after 20261001000000 (Phase 7), because
-- of the foreign key to "AgentApprovalRequest".
-- CreateEnum
CREATE TYPE "AgentTaskStatus" AS ENUM ('QUEUED', 'STARTING', 'RUNNING', 'CANCELLING', 'SUCCEEDED', 'FAILED', 'RETRY_QUEUED', 'CANCELLED', 'EXPIRED', 'TIMED_OUT');
-- CreateEnum
CREATE TYPE "AgentTaskRetryClass" AS ENUM ('SAFE_RETRY', 'CONDITIONAL_RETRY', 'NO_RETRY');
-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "taskRef" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "agentId" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "capabilityId" TEXT NOT NULL,
    "capabilityVersion" INTEGER NOT NULL,
    "adapterId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "input" JSONB NOT NULL,
    "inputDigest" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "idempotencyScope" TEXT,
    "activeOperationKey" TEXT,
    "approvalRequestId" TEXT,
    "authorizationPolicyRef" TEXT NOT NULL,
    "autonomyPolicyVersion" INTEGER,
    "retryClass" "AgentTaskRetryClass" NOT NULL,
    "status" "AgentTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL,
    "retryScheduled" BOOLEAN NOT NULL DEFAULT false,
    "cancelRequestedAt" TIMESTAMP(3),
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptStartedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "result" JSONB,
    "resultRemovedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorDetailCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id"),
    -- Defense in depth beyond the application state machine.
    CONSTRAINT "AgentTask_attempts_check" CHECK ("attempts" >= 0 AND "attempts" <= "maxAttempts"),
    CONSTRAINT "AgentTask_maxAttempts_check" CHECK ("maxAttempts" >= 1 AND "maxAttempts" <= 10),
    CONSTRAINT "AgentTask_retryScheduled_check" CHECK (NOT "retryScheduled" OR "status" = 'FAILED')
);
-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_taskRef_key" ON "AgentTask"("taskRef");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_idempotencyScope_key" ON "AgentTask"("idempotencyScope");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_activeOperationKey_key" ON "AgentTask"("activeOperationKey");
-- CreateIndex
CREATE UNIQUE INDEX "AgentTask_approvalRequestId_key" ON "AgentTask"("approvalRequestId");
-- CreateIndex
CREATE INDEX "AgentTask_connectionId_status_idx" ON "AgentTask"("connectionId", "status");
-- CreateIndex
CREATE INDEX "AgentTask_status_expiresAt_idx" ON "AgentTask"("status", "expiresAt");
-- CreateIndex
CREATE INDEX "AgentTask_ownerId_createdAt_idx" ON "AgentTask"("ownerId", "createdAt");
-- CreateIndex
CREATE INDEX "AgentTask_finishedAt_idx" ON "AgentTask"("finishedAt");
-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "AgentApprovalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
