import { db } from "@/lib/db"
import { embedTexts } from "@/lib/ai-support/provider"
import { env } from "@/lib/env"

export interface RetrievedChunk {
  id: string
  content: string
  documentId: string
  sourceId: string
  title: string
  canonicalUrl: string | null
  score: number
}

export async function retrieve(query: string, topK?: number): Promise<RetrievedChunk[]> {
  const k = topK ?? env.AI_SUPPORT_TOP_K ?? 5
  const normalized = query.trim().slice(0, 500)
  if (!normalized) return []

  // Try vector search
  try {
    const [qEmb] = await embedTexts([normalized])
    if (qEmb?.length) {
      const rows = (await db.$queryRawUnsafe(
        `SELECT c.id, c.content, c."documentId", c."sourceId", d.title, d."canonicalUrl",
                1 - (c.embedding <=> $1::vector) as score
         FROM "KnowledgeChunk" c
         JOIN "KnowledgeDocument" d ON d.id = c."documentId"
         JOIN "KnowledgeSource" s ON s.id = c."sourceId"
         WHERE c.embedding IS NOT NULL AND s.status='ACTIVE' AND s."publicationState"='APPROVED' AND d."isActive"=true
         ORDER BY c.embedding <=> $1::vector LIMIT $2`,
        `[${qEmb.join(",")}]`,
        k,
      )) as RetrievedChunk[]
      if (rows.length) return rows
    }
  } catch {
    // fall through to lexical
  }

  // Lexical fallback: ILIKE
  const words = normalized.split(/\s+/).slice(0, 8).join(" & ")
  try {
    const rows = (await db.$queryRawUnsafe(
      `SELECT c.id, c.content, c."documentId", c."sourceId", d.title, d."canonicalUrl", 0.5 as score
       FROM "KnowledgeChunk" c
       JOIN "KnowledgeDocument" d ON d.id = c."documentId"
       JOIN "KnowledgeSource" s ON s.id = c."sourceId"
       WHERE s.status='ACTIVE' AND d."isActive"=true AND c.content ILIKE '%' || $1 || '%'
       LIMIT $2`,
      normalized.slice(0, 80),
      k,
    )) as RetrievedChunk[]
    return rows
  } catch {
    return []
  }
}
