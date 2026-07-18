import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import AdminAccessClient from "./AdminAccessClient"

export default async function AdminAccessPage() {
  const session = await auth()

  if (!session?.user?.id) redirect("/login")
  if (session.user.role === "SUPER_ADMIN") redirect("/admin")
  if (session.user.role !== "SUB_ADMIN") redirect("/unauthorized")

  return <AdminAccessClient />
}
