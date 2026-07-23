import { ReactNode } from "react"
import { redirect } from "next/navigation"
import { authState } from "@/lib/auth"
import { currentUser } from "@clerk/nextjs/server"
import { profileFromCurrentClerkUser } from "@/lib/services/clerk-user-sync"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { validateSubadminCredentialSession } from "@/lib/subadmin-workforce"

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const state = await authState()

  if (!state.clerkAuthenticated) {
    redirect("/login")
  }

  if (state.reason === "BANNED") {
    redirect("/unauthorized")
  }

  if (!state.session?.user?.id) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold text-muted-foreground">Dashboard temporarily unavailable</p>
          <h1 className="mt-2 text-2xl font-bold">Your login is valid, but your NexusAI account could not be loaded.</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This usually happens when the database connection is temporarily unavailable during Clerk account sync. Refresh once the database is reachable.
          </p>
          <a
            href="/dashboard"
            className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry dashboard
          </a>
        </section>
      </main>
    )
  }

  const session = state.session
  const clerkProfile = profileFromCurrentClerkUser(await currentUser())
  const displayName =
    clerkProfile?.name ||
    [clerkProfile?.firstName, clerkProfile?.lastName].filter(Boolean).join(" ") ||
    session.user.name ||
    "User"
  const adminAccess =
    session.user.role === "SUPER_ADMIN" || session.user.role === "SUB_ADMIN"
      ? await validateSubadminCredentialSession(session.user.id, session.user.role)
      : { allowed: false, reason: "NOT_ADMIN", permissions: [], panelEligible: false, landingPath: null }

  return (
    <DashboardLayoutClient 
      userId={session.user.id} 
      userName={displayName}
      userRole={session.user.role}
      canAccessAdmin={adminAccess.panelEligible}
      adminPanelHref={adminAccess.allowed ? adminAccess.landingPath ?? "/admin" : "/admin-access"}
      isVerified={session.user.isVerified ?? false}
    >
      {children}
    </DashboardLayoutClient>
  )
}
