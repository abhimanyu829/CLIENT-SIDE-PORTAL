import { ReactNode } from "react"
import { requireAdmin } from "@/lib/admin-auth"
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()

  return (
    <AdminLayoutClient
      isSuperAdmin={admin.isSuperAdmin}
      allowedPermissions={admin.permissions}
      userName={admin.name}
      userEmail={admin.email}
    >
      {children}
    </AdminLayoutClient>
  )
}
