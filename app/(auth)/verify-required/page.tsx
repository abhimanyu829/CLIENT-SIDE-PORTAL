"use client"

import Link from "next/link"
import { ClerkFailed, ClerkLoaded, ClerkLoading, UserProfile } from "@clerk/nextjs"
import { ClerkAuthFrame } from "@/components/auth/ClerkAuthFrame"
import { clerkAppearance } from "@/lib/clerk"

export default function VerifyRequiredPage() {
  return (
    <ClerkAuthFrame
      badge="Verification required"
      title="Complete your Clerk email verification"
      subtitle="NexusAI keeps your internal account, roles, and billing data in Prisma, but Clerk must still finish verification before the protected dashboard can unlock."
      highlights={[
        "Open the Clerk account center below to verify email or reset your password.",
        "MFA, recovery, and OAuth settings stay under Clerk's control.",
        "Prisma continues to own roles, subscriptions, and internal permissions.",
        "Once verified, the dashboard and admin shells can rehydrate normally.",
      ]}
      footer={
        <p className="text-center text-sm text-zinc-400">
          After verification,{" "}
          <Link href="/dashboard" className="font-medium text-violet-300 hover:text-violet-200">
            return to the dashboard
          </Link>
          .
        </p>
      }
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[#0d0d10]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6">
        <ClerkLoaded>
          <UserProfile
            routing="path"
            path="/verify-required"
            appearance={clerkAppearance}
          />
        </ClerkLoaded>
        <ClerkLoading>
          <div className="flex min-h-[420px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-black/20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-violet-500" />
          </div>
        </ClerkLoading>
        <ClerkFailed>
          <div className="rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-6 text-center text-sm text-red-200">
            Clerk account settings could not load. Check your publishable key, session domain, and Clerk dashboard
            configuration.
          </div>
        </ClerkFailed>
      </div>
    </ClerkAuthFrame>
  )
}
