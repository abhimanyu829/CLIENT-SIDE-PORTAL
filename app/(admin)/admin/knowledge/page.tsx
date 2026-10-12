import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"

export default async function KnowledgeAdminPage() {
  await requireAdmin()
  const sources = await db.knowledgeSource.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Knowledge Sources</h1>
      <p className="text-sm text-muted-foreground">Approved sources indexed for RAG. Use API /api/admin/knowledge to ingest/deactivate.</p>
      <table className="w-full text-sm border">
        <thead><tr><th className="border p-2">Title</th><th className="border p-2">URL</th><th className="border p-2">Status</th><th className="border p-2">Last ingested</th></tr></thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id}><td className="border p-2">{s.title}</td><td className="border p-2 truncate max-w-[240px]">{s.canonicalUrl ?? "-"}</td><td className="border p-2">{s.status}</td><td className="border p-2">{s.lastIngestedAt?.toISOString() ?? "-"}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
