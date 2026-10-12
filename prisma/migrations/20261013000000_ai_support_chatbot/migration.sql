-- CreateExtension vector if not exists (pgvector already enabled on datasource)
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable KnowledgeSource
CREATE TABLE "KnowledgeSource" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "title" TEXT NOT NULL,
    "sourceHash" TEXT,
    "publicationState" TEXT NOT NULL DEFAULT 'APPROVED',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastIngestedAt" TIMESTAMP(3),
    "errorDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KnowledgeSource_canonicalUrl_key" ON "KnowledgeSource"("canonicalUrl");
CREATE INDEX "KnowledgeSource_status_publicationState_idx" ON "KnowledgeSource"("status", "publicationState");

-- CreateTable KnowledgeDocument
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "contentHash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KnowledgeDocument_sourceId_idx" ON "KnowledgeDocument"("sourceId");
CREATE INDEX "KnowledgeDocument_isActive_idx" ON "KnowledgeDocument"("isActive");

-- CreateTable KnowledgeChunk
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "KnowledgeChunk_documentId_idx" ON "KnowledgeChunk"("documentId");
CREATE INDEX "KnowledgeChunk_sourceId_idx" ON "KnowledgeChunk"("sourceId");

-- CreateTable AiSupportConversation
CREATE TABLE "AiSupportConversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestTokenHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT,
    "ticketId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiSupportConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiSupportConversation_guestTokenHash_key" ON "AiSupportConversation"("guestTokenHash");
CREATE INDEX "AiSupportConversation_userId_idx" ON "AiSupportConversation"("userId");
CREATE INDEX "AiSupportConversation_guestTokenHash_idx" ON "AiSupportConversation"("guestTokenHash");
CREATE INDEX "AiSupportConversation_status_idx" ON "AiSupportConversation"("status");

-- CreateTable AiSupportMessage
CREATE TABLE "AiSupportMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "toolCalls" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSupportMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiSupportMessage_conversationId_createdAt_idx" ON "AiSupportMessage"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiSupportMessage" ADD CONSTRAINT "AiSupportMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiSupportConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
