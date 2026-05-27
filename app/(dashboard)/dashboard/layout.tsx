import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/login")
  }

  return (
    <DashboardLayoutClient 
      userId={session.user.id} 
      userName={session.user.name ?? "User"}
      isVerified={session.user.isVerified ?? false}
    >
      {children}
    </DashboardLayoutClient>
  )
}