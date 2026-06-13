"use client"

import Link from "next/link"
import { use } from "react"
import { ClerkFailed, ClerkLoaded, ClerkLoading, SignIn } from "@clerk/nextjs"
import { clerkLightAppearance } from "@/lib/clerk"

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_25%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_40%,#ffffff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] lg:p-10">
          <div className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-indigo-700">
            Secure access
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Welcome back to NexusAI
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
            Sign in with Clerk to keep sessions, OAuth, MFA, and email recovery handled securely while NexusAI keeps
            ownership, billing, and permissions in Prisma.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Clerk handles email verification and password resets.",
              "OAuth users sync back into the existing Prisma account model.",
              "MFA and session management stay fully managed by Clerk.",
              "Role checks, checkout, and subscriptions remain on the NexusAI backend.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            If you came here from a protected page, Clerk will return you to that destination after sign-in.
          </div>
          <div className="mt-6 text-sm text-slate-500">
            New to NexusAI?{" "}
            <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
              Create your account
            </Link>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-6">
            <ClerkLoaded>
              <SignIn
                routing="path"
                path="/login"
                signUpUrl="/register"
                forceRedirectUrl={safeCallback}
                fallbackRedirectUrl={safeCallback}
                appearance={clerkLightAppearance}
              />
            </ClerkLoaded>
            <ClerkLoading>
              <div className="flex min-h-[520px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-slate-50">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-500" />
              </div>
            </ClerkLoading>
            <ClerkFailed>
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
                Clerk could not load. Check your publishable key, login route, and middleware catch-all configuration.
              </div>
            </ClerkFailed>
          </div>
        </section>
      </div>
    </div>
  )
}
