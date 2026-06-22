import { db } from "@/lib/db"
import EmailCenterClient from "@/components/admin/EmailCenterClient"
import { requireServiceOperationsAccess } from "@/lib/admin-auth"

export default async function AdminServiceEmailsPage() {
  await requireServiceOperationsAccess("emails")

  const campaigns = await db.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdByAdmin: { select: { id: true, name: true, email: true } },
      queueItems: { select: { id: true, status: true, recipient: true, emailType: true, createdAt: true } },
    },
  })

  const serviceCampaigns = campaigns.filter((campaign) => {
    const payload = (campaign.payload as { serviceScope?: string } | null) ?? null
    return campaign.templateName.toLowerCase().includes("service") || payload?.serviceScope === "SERVICES"
  })

  const stats = {
    total: serviceCampaigns.length,
    sending: serviceCampaigns.filter((campaign) => campaign.status === "SENDING").length,
    sent: serviceCampaigns.filter((campaign) => campaign.status === "SENT").length,
    draft: serviceCampaigns.filter((campaign) => campaign.status === "DRAFT").length,
  }

  const serializedCampaigns = serviceCampaigns.map((campaign) => ({
    ...campaign,
    createdAt: campaign.createdAt.toISOString(),
    scheduledAt: campaign.scheduledAt?.toISOString() ?? null,
    sentAt: campaign.sentAt?.toISOString() ?? null,
    queueItems: campaign.queueItems.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
    })),
  }))

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white">Service Email Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">
          Isolated campaign center for service-platform announcements, lead follow-up, cancellations, refunds, and admin broadcasts.
        </p>
      </div>
      <EmailCenterClient
        campaigns={serializedCampaigns as any}
        stats={stats}
        apiBasePath="/api/admin/services/emails"
        heading="Service Email Center"
        description="Dedicated workflows for the service vertical only."
        defaultTemplateName="SERVICE_REQUEST_ADMIN"
        defaultPayload='{"serviceScope":"SERVICES","title":"Service update","body":"Hello from the NexusAI service platform"}'
        defaultAudienceFilter='{"roles":["CLIENT"],"serviceScope":"SERVICES"}'
      />
    </div>
  )
}
