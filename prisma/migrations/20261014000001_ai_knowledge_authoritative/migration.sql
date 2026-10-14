-- AI Support chatbot — authoritative knowledge management (hallucination fix).
-- Adds the admin-authored P1 content body plus category/version/expiry and the
-- contentType discriminator the retrieval layer already relies on. All columns
-- are additive; existing website sources keep working with the 'page' default.

ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "contentType" TEXT NOT NULL DEFAULT 'page';
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "directContent" TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "KnowledgeSource" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "KnowledgeSource_contentType_publicationState_idx" ON "KnowledgeSource"("contentType", "publicationState");
