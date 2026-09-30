-- Abhibhi Agent Gateway — Phase 2 additive migration.
-- Contains ONLY the new Agent Gateway objects. Deliberately excludes the
-- DROP TABLE statements for the legacy Catalog* tables that a naive
-- `prisma migrate diff` produced (those tables are out of scope for this
-- change and must not be dropped here).

-- CreateEnum
CREATE TYPE "AgentConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AgentAuthMethod" AS ENUM ('BEARER', 'SIGNED_REQUEST');

-- CreateEnum
CREATE TYPE "AgentCredentialStatus" AS ENUM ('ACTIVE', 'ROTATING', 'REVOKED', 'EXPIRED');

-- CreateTable
CREATE TABLE "AgentConnection" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalAgentId" TEXT,
    "description" TEXT,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "status" "AgentConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "authMethod" "AgentAuthMethod" NOT NULL DEFAULT 'BEARER',
    "environment" TEXT NOT NULL DEFAULT 'development',
    "lastAuthenticatedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "AgentConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentCredential" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "status" "AgentCredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "secretHash" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "keyId" TEXT,
    "signingSecretRef" TEXT,
    "replacesCredentialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,

    CONSTRAINT "AgentCredential_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentConnection_ownerId_idx" ON "AgentConnection"("ownerId");

-- CreateIndex
CREATE INDEX "AgentConnection_teamId_idx" ON "AgentConnection"("teamId");

-- CreateIndex
CREATE INDEX "AgentConnection_status_idx" ON "AgentConnection"("status");

-- CreateIndex
CREATE INDEX "AgentConnection_provider_idx" ON "AgentConnection"("provider");

-- CreateIndex
CREATE INDEX "AgentConnection_externalAgentId_idx" ON "AgentConnection"("externalAgentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_secretHash_key" ON "AgentCredential"("secretHash");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_keyId_key" ON "AgentCredential"("keyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCredential_replacesCredentialId_key" ON "AgentCredential"("replacesCredentialId");

-- CreateIndex
CREATE INDEX "AgentCredential_connectionId_idx" ON "AgentCredential"("connectionId");

-- CreateIndex
CREATE INDEX "AgentCredential_status_idx" ON "AgentCredential"("status");

-- CreateIndex
CREATE INDEX "AgentCredential_fingerprint_idx" ON "AgentCredential"("fingerprint");

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentConnection" ADD CONSTRAINT "AgentConnection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AgentConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentCredential" ADD CONSTRAINT "AgentCredential_replacesCredentialId_fkey" FOREIGN KEY ("replacesCredentialId") REFERENCES "AgentCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
