import ServiceWorkspaceClient from "./ServiceWorkspaceClient"

export const metadata = { title: "Service Workspace | NexusAI" }

export default async function ServiceWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ServiceWorkspaceClient serviceId={id} />
}
