"use client"

import { use } from "react"
import { ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs"
import { clerkAuralisAppearance } from "@/lib/clerk"

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string | string[] }>
}) {
  const resolvedSearchParams = use(
    searchParams ?? Promise.resolve({ callbackUrl: undefined })
  ) as { callbackUrl?: string | string[] }
  const callback = Array.isArray(resolvedSearchParams?.callbackUrl)
    ? resolvedSearchParams.callbackUrl[0]
    : resolvedSearchParams?.callbackUrl
  const safeCallback =
    callback && callback.startsWith("/") && !callback.startsWith("//")
      ? callback
      : "/dashboard"

  return (
    <div className="flex w-full items-center justify-center">
      <ClerkLoaded>
        <SignIn
          routing="path"
          path="/login"
          signUpUrl="/register"
          forceRedirectUrl={safeCallback}
          fallbackRedirectUrl={safeCallback}
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
