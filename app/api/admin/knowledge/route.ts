import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { ingestSource, ingestAuthoritative, seedDefaultSources } from "@/lib/ai-support/ingest"
import { z } from "zod"

export async function GET() {
  await requireAdmin()
  const sources = await db.knowledgeSource.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ sources })
}

const createSchema = z.object({
  title: z.string().min(2).max(200),
  contentType: z.enum(["authoritative", "page"]).default("page"),
  category: z.string().max(100).optional(),
  canonicalUrl: z.string().url().optional(),
  directContent: z.string().max(20000).optional(),
  publicationState: z.enum(["DRAFT", "APPROVED"]).optional(),
  expiresAt: z.string().datetime().optional(),
})

const updateSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  category: z.string().max(100).nullable().optional(),
  canonicalUrl: z.string().url().nullable().optional(),
  directContent: z.string().max(20000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
})

/** Re-index a source using its current persisted state. */
async function reingest(source: {
  id: string
  sourceType: string
  directContent: string | null
}): Promise<{ chunks: number }> {
  if (source.sourceType === "authoritative" && source.directContent?.trim()) {
    return ingestAuthoritative(source.id, source.directContent)
  }
  return ingestSource(source.id)
}

export async function POST(req: Request) {
  await requireAdmin()
  const body = await req.json().catch(() => null)
  if (body?.seed) {
    await seedDefaultSources()
    return NextResponse.json({ ok: true })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  const { title, contentType, category, canonicalUrl, directContent, publicationState, expiresAt } = parsed.data
  const isAuthoritative = contentType === "authoritative"
  if (isAuthoritative && !directContent?.trim()) {
    return NextResponse.json({ error: "Approved content is required for an authoritative entry" }, { status: 400 })
  }
  if (!isAuthoritative && !canonicalUrl) {
    return NextResponse.json({ error: "A canonical URL is required for a website page source" }, { status: 400 })
  }

  const source = await db.knowledgeSource.create({
    data: {
      sourceType: isAuthoritative ? "authoritative" : "page",
      title,
      contentType,
      category: category ?? null,
      canonicalUrl: canonicalUrl ?? null,
      directContent: isAuthoritative ? directContent!.trim() : null,
      publicationState: publicationState ?? (isAuthoritative ? "DRAFT" : "APPROVED"),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    } as never,
  })

  // Index immediately. Draft authoritative entries intentionally store no
  // retrievable chunks until published (see ingestAuthoritative).
  let ingest: { chunks: number } = { chunks: 0 }
  try {
    ingest = await reingest(source)
  } catch (err) {
    return NextResponse.json({ source, ingest, error: `Ingestion failed: ${(err as Error).message}` }, { status: 201 })
  }
  return NextResponse.json({ source, ingest }, { status: 201 })
}

export async function PATCH(req: Request) {
  await requireAdmin()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const action = searchParams.get("action")

  const source = await db.knowledgeSource.findUnique({ where: { id } })
  if (!source) return NextResponse.json({ error: "Source not found" }, { status: 404 })

  if (action === "ingest") {
    const r = await reingest(source)
    return NextResponse.json(r)
  }

  if (action === "publish") {
    await db.knowledgeSource.update({
      where: { id },
      data: { publicationState: "APPROVED", status: "ACTIVE" },
    })
    // Re-index under the published state so current content becomes retrievable.
    const r = await reingest(source)
    return NextResponse.json({ ok: true, ingest: r })
  }

  if (action === "unpublish") {
    await db.knowledgeSource.update({ where: { id }, data: { publicationState: "DRAFT" } })
    // Make sure no previously-indexed chunks remain retrievable.
    await db.knowledgeDocument.updateMany({ where: { sourceId: id }, data: { isActive: false } })
    await db.knowledgeChunk.deleteMany({ where: { sourceId: id } })
    return NextResponse.json({ ok: true })
  }

  if (action === "deactivate") {
    await db.knowledgeSource.update({ where: { id }, data: { status: "INACTIVE" } })
    await db.knowledgeDocument.updateMany({ where: { sourceId: id }, data: { isActive: false } })
    await db.knowledgeChunk.deleteMany({ where: { sourceId: id } })
    return NextResponse.json({ ok: true })
  }

  if (action === "update") {
    const body = await req.json().catch(() => null)
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const data: Record<string, unknown> = {}
    if (parsed.data.title !== undefined) data.title = parsed.data.title
    if (parsed.data.category !== undefined) data.category = parsed.data.category
    if (parsed.data.canonicalUrl !== undefined) data.canonicalUrl = parsed.data.canonicalUrl
    if (parsed.data.expiresAt !== undefined) data.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null
    if (parsed.data.directContent !== undefined) {
      if (!parsed.data.directContent.trim()) {
        return NextResponse.json({ error: "Approved content cannot be empty" }, { status: 400 })
      }
      data.directContent = parsed.data.directContent.trim()
      // Bump the version so the newest content replaces the previous chunks.
      data.version = { increment: 1 }
    }
    const updated = await db.knowledgeSource.update({ where: { id }, data: data as never })
    // Editing published content must take effect immediately.
    let ingest: { chunks: number } | null = null
    if (updated.publicationState === "APPROVED" && updated.status === "ACTIVE") {
      try {
        ingest = await reingest(updated)
      } catch (err) {
        return NextResponse.json({ source: updated, error: `Re-index failed: ${(err as Error).message}` }, { status: 200 })
      }
    }
    return NextResponse.json({ source: updated, ingest })
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
