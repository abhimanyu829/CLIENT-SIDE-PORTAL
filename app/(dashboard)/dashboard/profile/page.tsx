import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { redirect } from "next/navigation"
import { ClerkFailed, ClerkLoaded, ClerkLoading, UserProfile } from "@clerk/nextjs"
import { clerkAppearance } from "@/lib/clerk"
import ProfileClient from "@/components/dashboard/ProfileClient"

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      timezone: true,
      notifPrefs: true,
      isVerified: true,
      emailVerified: true,
      phoneVerified: true,
    },
  })

  if (!user) redirect("/login")

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:p-6">
        <div className="mb-4">
          <h1 className="text-2xl font-black text-white">Account center</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Clerk manages identity, verification, and password recovery here. NexusAI continues to own the internal
            profile, notifications, and permission data.
          </p>
        </div>
        <ClerkLoaded>
          <UserProfile routing="path" path="/dashboard/profile" appearance={clerkAppearance} />
        </ClerkLoaded>
        <ClerkLoading>
          <div className="flex min-h-[420px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-violet-500" />
          </div>
        </ClerkLoading>
        <ClerkFailed>
          <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
            Clerk account settings could not load. Refresh after confirming your Clerk keys and session configuration.
          </div>
        </ClerkFailed>
      </section>

      <ProfileClient
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? "",
          timezone: user.timezone,
          notifPrefs: user.notifPrefs as any,
          isVerified: user.isVerified,
          emailVerified: user.emailVerified?.toISOString() ?? null,
          phoneVerified: user.phoneVerified?.toISOString() ?? null,
        }}
      />
    </div>
  )
}
