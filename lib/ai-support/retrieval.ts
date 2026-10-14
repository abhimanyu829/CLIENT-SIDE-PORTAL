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

const STOPWORDS = new Set([
  "what","where","when","which","how","why","who","whom","whose","whether",
  "the","and","are","you","your","our","for","with","about","from","that","this","have","has","had","can","will","would","should","could","may","might","must","shall",
  "is","it","its","are","was","were","been","am","be","by","we","us","my","me","i","a","an","to","of","in","on","at","or","as","if","so","no","yes","not","but","do","does","did","done","hi","hii","hello","hey","thanks","thank","please","tell","give","know","want","need","like","just","also",
])

const SCORE_THRESHOLD_LEXICAL = 0.62
const SCORE_THRESHOLD_VECTOR = 0.25

export type RetrieveOpts = { topK?: number; includeDrafts?: boolean }

function extraWhere(includeDrafts: boolean) {
  return includeDrafts ? "" : "AND s.\"publicationState\"='APPROVED' AND (s.\"expiresAt\" IS NULL OR s.\"expiresAt\" > NOW())"
}

/**
 * Code-level eligibility gate applied to every row the DB returns. This is a
 * belt-and-braces companion to the SQL WHERE clause: even if a caller uses
 * includeDrafts, or a raw query returns stale rows, draft, inactive and
 * expired content can never reach the answer pipeline.
 */
export function filterRetrievable<
  T extends { status?: string | null; publicationState?: string | null; expiresAt?: Date | string | null }
>(rows: T[]): T[] {
  const now = Date.now()
  return rows.filter((r) => {
    if (r.status && r.status !== "ACTIVE") return false
    if (r.publicationState && r.publicationState !== "APPROVED") return false
    if (r.expiresAt && new Date(r.expiresAt).getTime() <= now) return false
    return true
  })
}

export function prioritizeBySourceType(rows: (RetrievedChunk & { contentType?: string; score: number })[], k: number): RetrievedChunk[] {
  const p1 = rows.filter((r) => (r as any).contentType === "authoritative")
  const p2 = rows.filter((r) => (r as any).contentType !== "authoritative")
  if (p1.length === 0) return rows.slice(0, k) as RetrievedChunk[]
  if (p1.length >= k) return p1.slice(0, k) as RetrievedChunk[]
  const need = k - p1.length
  const compatible = p2.filter((b) => !conflictsWithAuthoritative(p1.map((x) => x.content).join(" "), b.content))
  const supplement = compatible.length ? compatible.slice(0, need) : []
  return [...p1 as RetrievedChunk[], ...supplement as RetrievedChunk[]]
}

export function conflictsWithAuthoritative(authText: string, siteText: string): boolean {
  const priceRe = /(₹|\$|RS\.?)\s*\d[\d,]*/i
  const aPrice = authText.match(priceRe)?.[0]?.replace(/\s+/g, "")
  const bPrice = siteText.match(priceRe)?.[0]?.replace(/\s+/g, "")
  if (aPrice && bPrice && aPrice.toLowerCase() !== bPrice.toLowerCase()) return true
  const emailRe = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  const aEmail = authText.match(emailRe)?.[0]?.toLowerCase()
  const bEmail = siteText.match(emailRe)?.[0]?.toLowerCase()
  if (aEmail && bEmail && aEmail !== bEmail) return true
  return false
}

export function detectConflictAmong(rows: (RetrievedChunk & { contentType?: string })[]): boolean {
  const auth = rows.filter((r) => (r as any).contentType === "authoritative")
  if (auth.length < 2) return false
  for (let i = 0; i < auth.length; i++) for (let j = i + 1; j < auth.length; j++) if (conflictsWithAuthoritative(auth[i].content, auth[j].content)) return true
  return false
}

export async function retrieve(query: string, topKOrOpts?: number | RetrieveOpts): Promise<RetrievedChunk[]> {
  const opts: RetrieveOpts = typeof topKOrOpts === "number" ? { topK: topKOrOpts } : (topKOrOpts ?? {})
  const k = opts.topK ?? env.AI_SUPPORT_TOP_K ?? 5
  const includeDrafts = !!opts.includeDrafts
  const normalized = query.trim().slice(0, 500)
  if (!normalized) return []

  const lower = normalized.toLowerCase()
  const hasContactIntent = lower.includes("email") || lower.includes("support") || lower.includes("contact")

  try {
    const [qEmb] = await embedTexts([normalized])
    if (qEmb?.length) {
      const rawRows = (await db.$queryRawUnsafe(
        `SELECT c.id, c.content, c."documentId", c."sourceId", d.title, d."canonicalUrl", s."contentType" as "contentType",
                s."status", s."publicationState", s."expiresAt",
                1 - (c.embedding <=> $1::vector) as score
         FROM "KnowledgeChunk" c
         JOIN "KnowledgeDocument" d ON d.id = c."documentId"
         JOIN "KnowledgeSource" s ON s.id = c."sourceId"
         WHERE c.embedding IS NOT NULL AND s.status='ACTIVE' ${extraWhere(includeDrafts)} AND d."isActive"=true
         ORDER BY c.embedding <=> $1::vector LIMIT $2`,
        `[${qEmb.join(",")}]`,
        k * 4,
      )) as (RetrievedChunk & { contentType: string; status: string; publicationState: string; expiresAt: Date | null })[]
      const rows = filterRetrievable(rawRows)
      const filtered = rows.filter((r) => (r.score ?? 0) >= SCORE_THRESHOLD_VECTOR)
      let top = (filtered.length ? filtered : rows).slice(0, k * 2)
      if (hasContactIntent) {
        const emailHits = top.filter((r) => r.content.includes("@"))
        if (emailHits.length) top = emailHits.slice(0, k * 2)
      }
      if (top.length) {
        top = top.filter((r) => r.content.trim().length > 20)
        const prioritized = prioritizeBySourceType(top as any, k)
        if (prioritized.length) return prioritized
        return top.slice(0, k)
      }
    }
  } catch {
  }

  const rawWords = normalized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
  const words = rawWords.filter((w) => !STOPWORDS.has(w) || (hasContactIntent && (w === "email" || w === "support" || w === "contact")))
    .slice(0, 6)
  const effectiveWords = words.length ? words : rawWords.filter((w) => w.length > 3).slice(0, 3)
  try {
    if (effectiveWords.length === 0) return []
    const placeholders = effectiveWords.map((_, i) => `c.content ILIKE '%' || $${i + 2} || '%'`).join(" OR ")
    const matchExpr = effectiveWords.map((_, i) => `CASE WHEN c.content ILIKE '%' || $${i + 2} || '%' THEN 1 ELSE 0 END`).join(" + ")
    const rawLexicalRows = (await db.$queryRawUnsafe(
      `SELECT c.id, c.content, c."documentId", c."sourceId", d.title, d."canonicalUrl", s."contentType" as "contentType",
              s."status", s."publicationState", s."expiresAt",
              0.5 + ((${matchExpr})::numeric / 10) as score,
              (${matchExpr}) as matched
       FROM "KnowledgeChunk" c
       JOIN "KnowledgeDocument" d ON d.id = c."documentId"
       JOIN "KnowledgeSource" s ON s.id = c."sourceId"
       WHERE s.status='ACTIVE' ${extraWhere(includeDrafts)} AND d."isActive"=true AND (${placeholders})
       ORDER BY matched DESC, score DESC
       LIMIT $1`,
      k * 3,
      ...effectiveWords,
    )) as (RetrievedChunk & { matched: number; status: string; publicationState: string; expiresAt: Date | null })[]
    const rows = filterRetrievable(rawLexicalRows)
    let filtered = rows.filter((r) => r.score >= SCORE_THRESHOLD_LEXICAL)
    if (hasContactIntent) {
      const emailFiltered = filtered.filter((r) => r.content.includes("@"))
      if (emailFiltered.length) filtered = emailFiltered
      else {
        const emailRows = rows.filter((r) => r.content.includes("@"))
        if (emailRows.length) {
          const pri = prioritizeBySourceType(emailRows as any, k)
          return pri.length ? pri : emailRows.slice(0, k)
        }
      }
    }
    let out: (RetrievedChunk & { matched: number; contentType?: string })[]
    if (effectiveWords.length >= 3) {
      const strong = filtered.filter((r) => (r.matched ?? 0) >= 2)
      out = strong.length ? strong : filtered
    } else out = filtered
    const asAny = out as unknown as (RetrievedChunk & { contentType?: string })[]
    const pri = prioritizeBySourceType(asAny as any, k)
    if (pri.length && asAny.some((r) => r.contentType === "authoritative")) return pri
    return out.slice(0, k)
  } catch {
    return []
  }
}
