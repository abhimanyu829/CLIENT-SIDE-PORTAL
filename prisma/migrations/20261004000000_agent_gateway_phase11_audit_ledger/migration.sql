-- Abhibhi Agent Gateway — Phase 11 additive migration (audit ledger,
-- recovery). Generated with `prisma migrate diff` between the Phase 10
-- schema and the Phase 11 schema (datamodel to datamodel, so the live
-- database's out-of-scope Catalog* drift is not involved), plus the
-- append-only trigger at the end, which Prisma cannot express.
-- Creates two tables and three enums and adds ONE nullable column to the
-- Phase 8 "AgentTask" table. No other existing object is altered.
-- Apply after 20261003000000 (Phase 9).

-- CreateEnum
CREATE TYPE "AgentAuditCategory" AS ENUM ('AUTHENTICATION', 'IDENTITY', 'CAPABILITY', 'AUTHORIZATION', 'APPROVAL', 'AUTONOMY', 'EXECUTION', 'TASK', 'TRIGGER', 'WEBHOOK', 'SCHEDULE', 'POLICY', 'SECURITY', 'FAILURE', 'ROLLBACK', 'ADMIN_GOVERNANCE', 'CONFIGURATION');

-- CreateEnum
CREATE TYPE "AgentAuditOutcome" AS ENUM ('SUCCESS', 'DENIED', 'FAILED', 'INFO');

-- CreateEnum
CREATE TYPE "AgentRecoveryStatus" AS ENUM ('REQUESTED', 'EXECUTING', 'APPROVAL_REQUIRED', 'SUCCEEDED', 'FAILED', 'MANUAL_RECOVERY_REQUIRED');

-- AlterTable
ALTER TABLE "AgentTask" ADD COLUMN     "traceId" TEXT;

-- CreateTable
CREATE TABLE "AgentAuditEvent" (
    "id" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "category" "AgentAuditCategory" NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" "AgentAuditOutcome" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestId" TEXT,
    "traceId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "connectionId" TEXT,
    "agentId" TEXT,
    "ownerId" TEXT,
    "teamId" TEXT,
    "capabilityId" TEXT,
    "capabilityVersion" INTEGER,
    "riskTier" TEXT,
    "resourceType" TEXT,
    "resourceRef" TEXT,
    "environment" TEXT,
    "authorizationDecision" TEXT,
    "authorizationPolicyRef" TEXT,
    "autonomyLevel" TEXT,
    "autonomyPolicyVersion" INTEGER,
    "approvalRef" TEXT,
    "taskRef" TEXT,
    "triggerRef" TEXT,
    "adapterId" TEXT,
    "executionStatus" TEXT,
    "resultCode" TEXT,
    "errorCode" TEXT,
    "inputDigest" TEXT,
    "outputDigest" TEXT,
    "metadata" JSONB,
    "previousEventDigest" TEXT NOT NULL,
    "eventDigest" TEXT NOT NULL,

    CONSTRAINT "AgentAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRecovery" (
    "id" TEXT NOT NULL,
    "publicRef" TEXT NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "capabilityVersion" INTEGER NOT NULL,
    "recoveryClass" TEXT NOT NULL,
    "recoveryCapabilityId" TEXT,
    "recoveryCapabilityVersion" INTEGER,
    "status" "AgentRecoveryStatus" NOT NULL DEFAULT 'REQUESTED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "reason" TEXT,
    "recommendation" TEXT,
    "residualEffects" TEXT,
    "approvalRef" TEXT,
    "errorCode" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentAuditEvent_sequence_key" ON "AgentAuditEvent"("sequence");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAuditEvent_eventId_key" ON "AgentAuditEvent"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentAuditEvent_eventDigest_key" ON "AgentAuditEvent"("eventDigest");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_occurredAt_idx" ON "AgentAuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_category_occurredAt_idx" ON "AgentAuditEvent"("category", "occurredAt");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_connectionId_occurredAt_idx" ON "AgentAuditEvent"("connectionId", "occurredAt");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_capabilityId_occurredAt_idx" ON "AgentAuditEvent"("capabilityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_requestId_idx" ON "AgentAuditEvent"("requestId");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_traceId_idx" ON "AgentAuditEvent"("traceId");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_taskRef_idx" ON "AgentAuditEvent"("taskRef");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_approvalRef_idx" ON "AgentAuditEvent"("approvalRef");

-- CreateIndex
CREATE INDEX "AgentAuditEvent_triggerRef_idx" ON "AgentAuditEvent"("triggerRef");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRecovery_publicRef_key" ON "AgentRecovery"("publicRef");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRecovery_sourceEventId_key" ON "AgentRecovery"("sourceEventId");

-- CreateIndex
CREATE INDEX "AgentRecovery_connectionId_requestedAt_idx" ON "AgentRecovery"("connectionId", "requestedAt");

-- CreateIndex
CREATE INDEX "AgentRecovery_status_idx" ON "AgentRecovery"("status");

-- Append-only enforcement (defence in depth below the application, which
-- has no update or delete path for this table). Refuses every UPDATE,
-- DELETE and TRUNCATE, including from privileged application roles. A
-- retention process, if one is ever designed, must be an explicit
-- maintenance procedure that records a signed checkpoint first; it is not
-- part of this migration.
CREATE OR REPLACE FUNCTION "agent_audit_event_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AgentAuditEvent is append-only (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AgentAuditEvent_no_update_delete"
  BEFORE UPDATE OR DELETE ON "AgentAuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "agent_audit_event_append_only"();

CREATE TRIGGER "AgentAuditEvent_no_truncate"
  BEFORE TRUNCATE ON "AgentAuditEvent"
  FOR EACH STATEMENT EXECUTE FUNCTION "agent_audit_event_append_only"();
