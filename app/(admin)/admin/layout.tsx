import { ReactNode } from "react"
import { requireAdmin } from "@/lib/admin-auth"
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()

  return (
    <AdminLayoutClient
      isSuperAdmin={admin.isSuperAdmin}
      userName={admin.name}
      userEmail={admin.email}
    >
      {children}
    </AdminLayoutClient>
  )
}
