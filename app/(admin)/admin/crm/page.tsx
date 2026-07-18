import { db } from "@/lib/db"
import { requireAdmin } from "@/lib/admin-auth"
import { redirect } from "next/navigation"
import AdminCRMClient from "./AdminCRMClient"
import { serializePrisma } from "@/lib/serialize-prisma"

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

  return <AdminCRMClient leads={serializePrisma(leads)} sequences={serializePrisma(sequences)} />
}
