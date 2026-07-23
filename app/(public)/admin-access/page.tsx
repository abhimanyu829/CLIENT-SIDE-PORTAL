import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import AdminAccessClient from "./AdminAccessClient"
import { validateSubadminCredentialSession } from "@/lib/subadmin-workforce"

export default async function AdminAccessPage() {
  const session = await auth()

  if (!session?.user?.id) redirect("/login")
  if (session.user.role === "SUPER_ADMIN") redirect("/admin")
  if (session.user.role !== "SUB_ADMIN") redirect("/unauthorized")

  const access = await validateSubadminCredentialSession(session.user.id, session.user.role)
  if (!access.panelEligible) redirect("/unauthorized")
  if (access.allowed) redirect(access.landingPath ?? "/admin")

  return <AdminAccessClient />
}
