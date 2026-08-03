import { requireAdmin } from "@/lib/admin-auth"
import DeploymentCenterClient from "./DeploymentCenterClient"

export const metadata = { title: "Deployment Center | NexusAI Admin" }

export default async function DeploymentCenterPage() {
  await requireAdmin()
  return <DeploymentCenterClient />
}
