CREATE TYPE "SubadminApplicationStatus" AS ENUM ('PENDING', 'SHORTLISTED', 'APPROVED', 'REJECTED');
CREATE TYPE "SubadminAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED', 'REVOKED');
CREATE TYPE "AdminApprovalStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

CREATE TABLE "SubadminApplication" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "country" TEXT,
  "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "portfolioUrl" TEXT,
  "githubUrl" TEXT,
  "linkedinUrl" TEXT,
  "resumeUrl" TEXT,
  "motivation" TEXT NOT NULL,
  "status" "SubadminApplicationStatus" NOT NULL DEFAULT 'PENDING',
  "adminNotes" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubadminApplication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubadminAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "applicationId" TEXT,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT,
  "accessTokenHash" TEXT,
  "status" "SubadminAccountStatus" NOT NULL DEFAULT 'PENDING',
  "credentialsActive" BOOLEAN NOT NULL DEFAULT false,
  "forceLogoutVersion" INTEGER NOT NULL DEFAULT 0,
  "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMP(3),
  "passwordChangedAt" TIMESTAMP(3),
  "lastCredentialRotatedAt" TIMESTAMP(3),
  "lastAdminLoginAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "disabledAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubadminAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubadminPermission" (
  "id" TEXT NOT NULL,
  "subadminId" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokeReason" TEXT,
  CONSTRAINT "SubadminPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubadminSession" (
  "id" TEXT NOT NULL,
  "subadminId" TEXT NOT NULL,
  "sessionTokenHash" TEXT NOT NULL,
  "clerkSessionHint" TEXT,
  "ip" TEXT,
  "userAgent" TEXT,
  "device" TEXT,
  "forceLogoutVersion" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubadminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubadminActivityLog" (
  "id" TEXT NOT NULL,
  "subadminId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "ip" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubadminActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubadminApprovalRequest" (
  "id" TEXT NOT NULL,
  "subadminId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT,
  "entityId" TEXT,
  "title" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "AdminApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "reviewNotes" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubadminApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminPortalSetting" (
  "id" TEXT NOT NULL DEFAULT 'subadmin-portal',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "applicationsOpen" BOOLEAN NOT NULL DEFAULT true,
  "portalPath" TEXT NOT NULL DEFAULT '/join-our-team',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminPortalSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubadminApplication_email_key" ON "SubadminApplication"("email");
CREATE INDEX "SubadminApplication_status_createdAt_idx" ON "SubadminApplication"("status", "createdAt");
CREATE INDEX "SubadminApplication_email_idx" ON "SubadminApplication"("email");

CREATE UNIQUE INDEX "SubadminAccount_userId_key" ON "SubadminAccount"("userId");
CREATE UNIQUE INDEX "SubadminAccount_applicationId_key" ON "SubadminAccount"("applicationId");
CREATE UNIQUE INDEX "SubadminAccount_email_key" ON "SubadminAccount"("email");
CREATE UNIQUE INDEX "SubadminAccount_username_key" ON "SubadminAccount"("username");
CREATE INDEX "SubadminAccount_status_idx" ON "SubadminAccount"("status");
CREATE INDEX "SubadminAccount_email_idx" ON "SubadminAccount"("email");
CREATE INDEX "SubadminAccount_userId_idx" ON "SubadminAccount"("userId");

CREATE UNIQUE INDEX "SubadminPermission_subadminId_resource_action_key" ON "SubadminPermission"("subadminId", "resource", "action");
CREATE INDEX "SubadminPermission_resource_action_idx" ON "SubadminPermission"("resource", "action");
CREATE INDEX "SubadminPermission_revokedAt_idx" ON "SubadminPermission"("revokedAt");

CREATE UNIQUE INDEX "SubadminSession_sessionTokenHash_key" ON "SubadminSession"("sessionTokenHash");
CREATE INDEX "SubadminSession_subadminId_revokedAt_idx" ON "SubadminSession"("subadminId", "revokedAt");
CREATE INDEX "SubadminSession_expiresAt_idx" ON "SubadminSession"("expiresAt");

CREATE INDEX "SubadminActivityLog_subadminId_createdAt_idx" ON "SubadminActivityLog"("subadminId", "createdAt");
CREATE INDEX "SubadminActivityLog_actorId_idx" ON "SubadminActivityLog"("actorId");
CREATE INDEX "SubadminActivityLog_action_idx" ON "SubadminActivityLog"("action");

CREATE INDEX "SubadminApprovalRequest_status_createdAt_idx" ON "SubadminApprovalRequest"("status", "createdAt");
CREATE INDEX "SubadminApprovalRequest_subadminId_idx" ON "SubadminApprovalRequest"("subadminId");
CREATE INDEX "SubadminApprovalRequest_resource_action_idx" ON "SubadminApprovalRequest"("resource", "action");

ALTER TABLE "SubadminApplication" ADD CONSTRAINT "SubadminApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubadminAccount" ADD CONSTRAINT "SubadminAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubadminAccount" ADD CONSTRAINT "SubadminAccount_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "SubadminApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubadminAccount" ADD CONSTRAINT "SubadminAccount_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubadminAccount" ADD CONSTRAINT "SubadminAccount_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubadminPermission" ADD CONSTRAINT "SubadminPermission_subadminId_fkey" FOREIGN KEY ("subadminId") REFERENCES "SubadminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubadminPermission" ADD CONSTRAINT "SubadminPermission_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubadminSession" ADD CONSTRAINT "SubadminSession_subadminId_fkey" FOREIGN KEY ("subadminId") REFERENCES "SubadminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubadminActivityLog" ADD CONSTRAINT "SubadminActivityLog_subadminId_fkey" FOREIGN KEY ("subadminId") REFERENCES "SubadminAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubadminActivityLog" ADD CONSTRAINT "SubadminActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubadminApprovalRequest" ADD CONSTRAINT "SubadminApprovalRequest_subadminId_fkey" FOREIGN KEY ("subadminId") REFERENCES "SubadminAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubadminApprovalRequest" ADD CONSTRAINT "SubadminApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubadminApprovalRequest" ADD CONSTRAINT "SubadminApprovalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminPortalSetting" ADD CONSTRAINT "AdminPortalSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
