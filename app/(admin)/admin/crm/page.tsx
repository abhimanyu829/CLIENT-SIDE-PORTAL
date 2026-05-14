import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminCRMClient from "./AdminCRMClient"

export default async function AdminCRMPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard")

  const [leads, sequences] = await Promise.all([
    db.lead.findMany({
      orderBy: { createdAt: "desc" },
      take: 200
    }),
    db.emailSequence.findMany({
      orderBy: { createdAt: "desc" },
      take: 50
    })
  ])

  return <AdminCRMClient leads={leads} sequences={sequences} />
}
