import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { currentUser } from "@clerk/nextjs/server"
import { profileFromCurrentClerkUser } from "@/lib/services/clerk-user-sync"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"

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

  return (
    <DashboardLayoutClient 
      userId={session.user.id} 
      userName={displayName}
      userRole={session.user.role}
      isVerified={session.user.isVerified ?? false}
    >
      {children}
    </DashboardLayoutClient>
  )
}
