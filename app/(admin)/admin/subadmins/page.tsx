import { requireSuperAdmin } from "@/lib/admin-auth"
import { getPortalSetting } from "@/lib/subadmin-workforce"
import { db } from "@/lib/db"
import SubadminManagementClient from "./SubadminManagementClient"

function prisma() {
  return db as any
}

export default async function SubadminManagementPage() {
  await requireSuperAdmin()

  const [applications, accounts, activityLogs, approvalRequests, portalSetting] = await Promise.all([
    prisma().subadminApplication.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    prisma().subadminAccount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        permissions: { where: { revokedAt: null } },
        sessions: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      take: 100,
    }),
    prisma().subadminActivityLog.findMany({
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { name: true, email: true } } },
      take: 100,
    }),
    prisma().subadminApprovalRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        subadmin: { select: { name: true, email: true, username: true } },
        requestedBy: { select: { name: true, email: true } },
        reviewedBy: { select: { name: true, email: true } },
      },
      take: 100,
    }),
    getPortalSetting(),
  ])

  return (
    <SubadminManagementClient
      initialData={JSON.parse(JSON.stringify({ applications, accounts, activityLogs, approvalRequests, portalSetting }))}
    />
  )
}
