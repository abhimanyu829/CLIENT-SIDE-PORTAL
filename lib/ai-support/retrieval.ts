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

  // Lexical fallback: any-significant-keyword ILIKE (OR) so conversational
  // queries match individual terms; ranked by crude word-count overlap.
  const words = normalized
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/gi, ""))
    .filter((w) => w.length > 2)
    .slice(0, 5)
  try {
    if (words.length === 0) return []
    const placeholders = words.map((_, i) => `c.content ILIKE '%' || $${i + 2} || '%'`).join(" OR ")
    const rows = (await db.$queryRawUnsafe(
      `SELECT c.id, c.content, c."documentId", c."sourceId", d.title, d."canonicalUrl",
                0.5 + (
                  (${words.map((_, i) => `CASE WHEN c.content ILIKE '%' || $${i + 2} || '%' THEN 1 ELSE 0 END`).join(" + ")})::numeric / 10
                ) as score
       FROM "KnowledgeChunk" c
       JOIN "KnowledgeDocument" d ON d.id = c."documentId"
       JOIN "KnowledgeSource" s ON s.id = c."sourceId"
       WHERE s.status='ACTIVE' AND d."isActive"=true AND (${placeholders})
       ORDER BY score DESC
       LIMIT $1`,
      k,
      ...words,
    )) as RetrievedChunk[]
    return rows
  } catch {
    return []
  }
}
