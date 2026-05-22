import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import ProjectsClient from "@/components/dashboard/ProjectsClient"

export default async function ProjectsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const projects = await db.project.findMany({
    where: { clientId: session.user.id },
    orderBy: { updatedAt: "desc" },
  })

  return <ProjectsClient initialProjects={projects as any} />
}
