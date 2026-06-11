import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import AdminCRMClient from "./AdminCRMClient"

export default async function AdminCRMPage() {
  // Zero-trust: requireAdmin enforces SUPER_ADMIN | SUB_ADMIN from DB
  await requireAdmin()

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
