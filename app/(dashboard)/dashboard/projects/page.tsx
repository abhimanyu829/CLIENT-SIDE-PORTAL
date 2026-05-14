import { db } from "@/lib/db"
import ProjectsClient from "./ProjectsClient"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export default async function ProjectsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/auth/signin")
  }

  const projects = await db.project.findMany({
    where: { clientId: session.user.id }
  })

  return <ProjectsClient initialProjects={projects} />
}
