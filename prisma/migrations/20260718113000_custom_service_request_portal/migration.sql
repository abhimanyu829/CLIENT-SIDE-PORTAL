CREATE TYPE "CustomServiceRequestStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'DISCUSSION', 'PROPOSAL_SENT', 'APPROVED', 'IN_DEVELOPMENT', 'COMPLETED', 'CLOSED');
CREATE TYPE "CustomServiceMessageSenderType" AS ENUM ('CLIENT', 'ADMIN');

CREATE TABLE "CustomServicePortalSetting" (
  "id" TEXT NOT NULL DEFAULT 'custom-service-portal',
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "publicPath" TEXT NOT NULL DEFAULT '/request-service',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomServicePortalSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomServiceRequest" (
  "id" TEXT NOT NULL,
  "requestNumber" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "fullName" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "phone" TEXT,
  "companyName" TEXT,
  "serviceCategory" TEXT NOT NULL,
  "projectTitle" TEXT NOT NULL,
  "ideaDescription" TEXT NOT NULL,
  "problemStatement" TEXT,
  "requestedFeatures" TEXT,
  "targetUsers" TEXT,
  "expectedBudget" TEXT,
  "expectedTimeline" TEXT,
  "additionalNotes" TEXT,
  "status" "CustomServiceRequestStatus" NOT NULL DEFAULT 'NEW',
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomServiceRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomServiceDiscussionMessage" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "senderType" "CustomServiceMessageSenderType" NOT NULL,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomServiceDiscussionMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomServiceRequestAttachment" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "messageId" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomServiceRequestAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomServiceRequest_requestNumber_key" ON "CustomServiceRequest"("requestNumber");
CREATE INDEX "CustomServiceRequest_clientId_status_idx" ON "CustomServiceRequest"("clientId", "status");
CREATE INDEX "CustomServiceRequest_status_lastActivityAt_idx" ON "CustomServiceRequest"("status", "lastActivityAt");
CREATE INDEX "CustomServiceRequest_email_idx" ON "CustomServiceRequest"("email");
CREATE INDEX "CustomServiceDiscussionMessage_requestId_createdAt_idx" ON "CustomServiceDiscussionMessage"("requestId", "createdAt");
CREATE INDEX "CustomServiceDiscussionMessage_senderId_createdAt_idx" ON "CustomServiceDiscussionMessage"("senderId", "createdAt");
CREATE INDEX "CustomServiceRequestAttachment_requestId_idx" ON "CustomServiceRequestAttachment"("requestId");
CREATE INDEX "CustomServiceRequestAttachment_messageId_idx" ON "CustomServiceRequestAttachment"("messageId");

ALTER TABLE "CustomServicePortalSetting" ADD CONSTRAINT "CustomServicePortalSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomServiceRequest" ADD CONSTRAINT "CustomServiceRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomServiceDiscussionMessage" ADD CONSTRAINT "CustomServiceDiscussionMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CustomServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomServiceDiscussionMessage" ADD CONSTRAINT "CustomServiceDiscussionMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomServiceRequestAttachment" ADD CONSTRAINT "CustomServiceRequestAttachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CustomServiceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomServiceRequestAttachment" ADD CONSTRAINT "CustomServiceRequestAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CustomServiceDiscussionMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
