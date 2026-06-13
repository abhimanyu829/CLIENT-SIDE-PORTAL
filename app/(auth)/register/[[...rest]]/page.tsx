"use client"

import Link from "next/link"
import { SignUp } from "@clerk/nextjs"
import { ClerkAuthFrame } from "@/components/auth/ClerkAuthFrame"
import { clerkAppearance } from "@/lib/clerk"

export default function RegisterPage() {
  return (
    <ClerkAuthFrame
      badge="Create your account"
      title="Build your NexusAI workspace"
      subtitle="Let Clerk handle identity, verification, MFA, OAuth, and recovery while Prisma keeps ownership, subscriptions, and RBAC authoritative."
      highlights={[
        "Sign-up verification is handled directly by Clerk.",
        "Google and GitHub OAuth can land in the same internal user record.",
        "No payment or subscription logic moves into Clerk.",
        "The dashboard still resolves Prisma roles and permissions.",
      ]}
      footer={
        <p className="text-center text-sm text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-violet-300 hover:text-violet-200">
            Sign in
          </Link>
        </p>
      }
    >
      <div className="rounded-[1.75rem] border border-white/10 bg-[#0d0d10]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6">
        <SignUp
          routing="path"
          path="/register"
          signInUrl="/login"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
          appearance={clerkAppearance}
        />
      </div>
    </ClerkAuthFrame>
  )
}
