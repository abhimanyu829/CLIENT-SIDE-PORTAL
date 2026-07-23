import { requireAdmin } from "@/lib/admin-auth"
import ServiceCampaignCenterClient from "./ServiceCampaignCenterClient"

export const dynamic = "force-dynamic"

export default async function ServiceCampaignCenterPage() {
  await requireAdmin()
  return <ServiceCampaignCenterClient />
}
