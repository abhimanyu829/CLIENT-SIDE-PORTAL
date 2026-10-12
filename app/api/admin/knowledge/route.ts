import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { ingestSource, seedDefaultSources } from "@/lib/ai-support/ingest"
import { z } from "zod"

export async function GET() {
  await requireAdmin()
  const sources = await db.knowledgeSource.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json({ sources })
}

const createSchema = z.object({
  title: z.string().min(2).max(200),
  canonicalUrl: z.string().url().optional(),
  sourceType: z.string().default("page"),
})

export async function POST(req: Request) {
  await requireAdmin()
  const body = await req.json().catch(() => null)
  if (body?.seed) {
    await seedDefaultSources()
    return NextResponse.json({ ok: true })
  }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const s = await db.knowledgeSource.create({ data: parsed.data as never })
  return NextResponse.json({ source: s }, { status: 201 })
}

export async function PATCH(req: Request) {
  await requireAdmin()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const action = searchParams.get("action")
  if (action === "ingest") {
    const r = await ingestSource(id)
    return NextResponse.json(r)
  }
  if (action === "deactivate") {
    await db.knowledgeSource.update({ where: { id }, data: { status: "INACTIVE" } })
    await db.knowledgeDocument.updateMany({ where: { sourceId: id }, data: { isActive: false } })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 })
}
