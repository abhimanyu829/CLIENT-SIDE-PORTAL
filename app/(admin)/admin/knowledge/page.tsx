import { requireAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import { KnowledgeAdminClient } from "@/components/admin/KnowledgeAdminClient"

export default async function KnowledgeAdminPage() {
  await requireAdmin()
  const sources = await db.knowledgeSource.findMany({ orderBy: { createdAt: "desc" }, take: 100 })
  return <KnowledgeAdminClient initial={sources as never} />
}
