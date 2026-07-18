import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { currentUser } from "@clerk/nextjs/server"
import { profileFromCurrentClerkUser } from "@/lib/services/clerk-user-sync"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { validateSubadminCredentialSession } from "@/lib/subadmin-workforce"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  const clerkProfile = profileFromCurrentClerkUser(await currentUser())
  
  if (!session?.user?.id) {
    redirect("/login")
  }

  const displayName =
    clerkProfile?.name ||
    [clerkProfile?.firstName, clerkProfile?.lastName].filter(Boolean).join(" ") ||
    session.user.name ||
    "User"
  const adminAccess =
    session.user.role === "SUPER_ADMIN" || session.user.role === "SUB_ADMIN"
      ? await validateSubadminCredentialSession(session.user.id, session.user.role)
      : { allowed: false, reason: "NOT_ADMIN" }

  return (
    <DashboardLayoutClient 
      userId={session.user.id} 
      userName={displayName}
      userRole={session.user.role}
      canAccessAdmin={adminAccess.allowed}
      isVerified={session.user.isVerified ?? false}
    >
      {children}
    </DashboardLayoutClient>
  )
}
