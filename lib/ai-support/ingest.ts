import { db } from "@/lib/db"
import { chunkText, hashContent } from "@/lib/ai-support/chunking"
import { embedTexts } from "@/lib/ai-support/provider"
import { env } from "@/lib/env"

function stripBoilerplate(html: string): string {
  // Remove scripts/styles/nav/footer
  let t = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
  t = t.replace(/<[^>]+>/g, " ")
  return t.replace(/\s+/g, " ").trim()
}

async function getRawForSource(source: { canonicalUrl: string | null; title: string; sourceType: string }): Promise<string> {
  const direct = (source as any).directContent as string | undefined
  if (source.sourceType === "authoritative" && direct) return direct
  if (!source.canonicalUrl) return ""
  return fetch(source.canonicalUrl).then((r) => r.text()).catch(() => "")
}

export async function ingestSource(sourceId: string): Promise<{ chunks: number }> {
  const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } })
  if (!source) throw new Error("Source not found")
  const raw = await getRawForSource(source as any)
  if (!raw) {
    await db.knowledgeSource.update({ where: { id: sourceId }, data: { errorDetails: "Fetch failed", lastIngestedAt: new Date() } })
    return { chunks: 0 }
  }
  const text = (source as any).sourceType === "authoritative" ? raw.trim() : stripBoilerplate(raw)
  const hash = hashContent(text)
  if (source.sourceHash === hash) return { chunks: 0 }

  const doc = await db.knowledgeDocument.upsert({
    where: { id: `${sourceId}-doc` },
    create: { id: `${sourceId}-doc`, sourceId, title: source.title, canonicalUrl: source.canonicalUrl, contentHash: hash },
    update: { contentHash: hash, isActive: true, title: source.title, canonicalUrl: source.canonicalUrl },
  })

  await db.knowledgeChunk.deleteMany({ where: { documentId: doc.id } })
  const chunks = chunkText(text, env.AI_SUPPORT_CHUNK_SIZE, 100)
  if (chunks.length === 0) {
    await db.knowledgeSource.update({ where: { id: sourceId }, data: { sourceHash: hash, lastIngestedAt: new Date() } })
    return { chunks: 0 }
  }

  // Embed in batches of 20
  const embeddings: number[][] = []
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20)
    try {
      const embs = await embedTexts(batch)
      embeddings.push(...embs)
    } catch {
      // Fallback: store without embedding (lexical only)
      for (let j = 0; j < batch.length; j++) embeddings.push([])
    }
  }

  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings[i]
    const validEmbedding = Array.isArray(emb) && emb.length > 0 && emb.every((n) => typeof n === "number" && Number.isFinite(n))
    const vectorLiteral = validEmbedding ? `'[${emb.map((n) => Number(n.toFixed(6))).join(",")}]'::vector` : "NULL"
    await db.$executeRawUnsafe(
      `INSERT INTO "KnowledgeChunk" (id, "documentId", "sourceId", "chunkIndex", content, embedding, "createdAt") VALUES (gen_random_uuid()::text, $1, $2, $3, $4, ${vectorLiteral}, NOW())`,
      doc.id,
      sourceId,
      i,
      chunks[i],
    )
  }

  await db.knowledgeSource.update({ where: { id: sourceId }, data: { sourceHash: hash, lastIngestedAt: new Date(), errorDetails: null } })
  return { chunks: chunks.length }
}

export async function ingestAuthoritative(sourceId: string, content: string): Promise<{ chunks: number }> {
  const source = await db.knowledgeSource.findUnique({ where: { id: sourceId } })
  if (!source || (source as any).sourceType !== "authoritative") throw new Error("Authoritative source not found")
  const text = content.trim()
  if (!text) throw new Error("Content required")
  const hash = hashContent(text)
  const doc = await db.knowledgeDocument.upsert({
    where: { id: `${sourceId}-doc` },
    create: { id: `${sourceId}-doc`, sourceId, title: source.title, canonicalUrl: source.canonicalUrl, contentHash: hash },
    update: { contentHash: hash, isActive: (source as any).publicationState === "APPROVED" && (source as any).status === "ACTIVE", title: source.title, canonicalUrl: source.canonicalUrl },
  })
  await db.knowledgeChunk.deleteMany({ where: { documentId: doc.id } })
  if ((source as any).publicationState !== "APPROVED" || (source as any).status !== "ACTIVE") {
    await db.knowledgeSource.update({ where: { id: sourceId }, data: { sourceHash: hash, lastIngestedAt: new Date(), errorDetails: null } })
    return { chunks: 0 }
  }
  const chunks = chunkText(text, env.AI_SUPPORT_CHUNK_SIZE, 100)
  if (chunks.length === 0) {
    await db.knowledgeSource.update({ where: { id: sourceId }, data: { sourceHash: hash, lastIngestedAt: new Date() } })
    return { chunks: 0 }
  }
  const embeddings: number[][] = []
  for (let i = 0; i < chunks.length; i += 20) {
    const batch = chunks.slice(i, i + 20)
    try { embeddings.push(...(await embedTexts(batch))) } catch { for (let j = 0; j < batch.length; j++) embeddings.push([]) }
  }
  for (let i = 0; i < chunks.length; i++) {
    const emb = embeddings[i]
    const valid = Array.isArray(emb) && emb.length > 0 && emb.every((n) => typeof n === "number" && Number.isFinite(n))
    const lit = valid ? `'[${emb.map((n) => Number(n.toFixed(6))).join(",")}]'::vector` : "NULL"
    await db.$executeRawUnsafe(`INSERT INTO "KnowledgeChunk" (id, "documentId", "sourceId", "chunkIndex", content, embedding, "createdAt") VALUES (gen_random_uuid()::text, $1, $2, $3, $4, ${lit}, NOW())`, doc.id, sourceId, i, chunks[i])
  }
  await db.knowledgeSource.update({ where: { id: sourceId }, data: { sourceHash: hash, lastIngestedAt: new Date(), errorDetails: null } })
  return { chunks: chunks.length }
}

export async function seedDefaultSources(): Promise<void> {
  const defaults = [
    { sourceType: "page", canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/pricing`, title: "Pricing" },
    { sourceType: "page", canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/faq`, title: "FAQ" },
    { sourceType: "page", canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/docs`, title: "Docs" },
    { sourceType: "page", canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/refund-policy`, title: "Refund Policy" },
    { sourceType: "page", canonicalUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/privacy`, title: "Privacy" },
  ]
  for (const d of defaults) {
    await db.knowledgeSource.upsert({
      where: { canonicalUrl: d.canonicalUrl },
      create: d,
      update: {},
    })
  }
}
