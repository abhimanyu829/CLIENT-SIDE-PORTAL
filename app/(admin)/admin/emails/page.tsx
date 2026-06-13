import { requireSuperAdmin } from "@/lib/admin-auth"
import { db } from "@/lib/db"
import EmailCenterClient from "@/components/admin/EmailCenterClient"

export default async function AdminEmailsPage() {
  await requireSuperAdmin()

  const campaigns = await db.emailCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    include: {
      createdByAdmin: { select: { id: true, name: true, email: true } },
      queueItems: { select: { id: true, status: true, recipient: true, emailType: true, createdAt: true } },
    },
  })

  const stats = {
    total: await db.emailCampaign.count(),
    sending: await db.emailCampaign.count({ where: { status: "SENDING" } }),
    sent: await db.emailCampaign.count({ where: { status: "SENT" } }),
    draft: await db.emailCampaign.count({ where: { status: "DRAFT" } }),
  }

  const serializedCampaigns = campaigns.map((campaign) => ({
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
        <h1 className="text-3xl font-black text-white">Email Center</h1>
        <p className="mt-2 max-w-3xl text-sm text-zinc-500">
          Backend-authoritative email infrastructure for transactional, marketing, subscription, security, and admin communications.
        </p>
      </div>
      <EmailCenterClient campaigns={serializedCampaigns as any} stats={stats} />
    </div>
  )
}
