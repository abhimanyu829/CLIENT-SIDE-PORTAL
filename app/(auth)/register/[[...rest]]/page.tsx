"use client"

import { ClerkLoaded, ClerkLoading, SignUp } from "@clerk/nextjs"
import { clerkAuralisAppearance } from "@/lib/clerk"

export default function RegisterPage() {
  return (
    <div className="flex w-full items-center justify-center">
      <ClerkLoaded>
        <SignUp
          routing="path"
          path="/register"
          signInUrl="/login"
          forceRedirectUrl="/dashboard"
          fallbackRedirectUrl="/dashboard"
          appearance={clerkAuralisAppearance}
        />
      </ClerkLoaded>
      <ClerkLoading>
        <div className="flex h-[520px] w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
        </div>
      </ClerkLoading>
    </div>
  )
}
