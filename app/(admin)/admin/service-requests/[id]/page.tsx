import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/admin-auth"
import { assertCustomServiceRequestAccess } from "@/lib/custom-service-portal"
import { CustomServiceDiscussionClient } from "@/components/custom-service/CustomServiceDiscussionClient"

export const dynamic = "force-dynamic"
export default async function AdminServiceRequestDetailPage({ params }: { params: Promise<{ id: string }> }) { const admin = await requireAdmin(); const { id } = await params; try { await assertCustomServiceRequestAccess(id, admin.userId) } catch { redirect("/admin/service-requests") } return <CustomServiceDiscussionClient requestId={id} admin /> }
