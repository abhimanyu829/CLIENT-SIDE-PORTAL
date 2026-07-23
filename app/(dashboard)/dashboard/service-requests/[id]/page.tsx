import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { assertCustomServiceRequestAccess } from "@/lib/custom-service-portal"
import { CustomServiceDiscussionClient } from "@/components/custom-service/CustomServiceDiscussionClient"

export const dynamic = "force-dynamic"
export default async function ServiceRequestDiscussionPage({ params }: { params: Promise<{ id: string }> }) { const session = await auth(); const { id } = await params; if (!session?.user?.id) redirect(`/login?callbackUrl=/dashboard/service-requests/${id}`); try { await assertCustomServiceRequestAccess(id, session.user.id) } catch { redirect("/dashboard/service-requests") } return <CustomServiceDiscussionClient requestId={id} /> }
