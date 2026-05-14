import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import AdminUsersClient from "./AdminUsersClient"

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/dashboard")

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarUrl: true,
      createdAt: true,
      subscriptions: {
        take: 1,
        where: { status: "ACTIVE" },
        select: { tier: { select: { name: true } } }
      }
    }
  })

  return <AdminUsersClient initialUsers={users} />
}
