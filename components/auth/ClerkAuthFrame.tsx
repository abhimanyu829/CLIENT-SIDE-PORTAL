"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { ClerkFailed, ClerkLoaded, ClerkLoading } from "@clerk/nextjs"

type ClerkAuthFrameProps = {
  badge?: string
  title: string
  subtitle: string
  highlights: string[]
  children: ReactNode
  footer?: ReactNode
}

function LoadingState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="w-full max-w-xl rounded-[1.75rem] border border-white/10 bg-[#0d0d10]/95 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-violet-500" />
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-sm text-zinc-400">{subtitle}</p>
      </div>
    </div>
  )
}

export function ClerkAuthFrame({
  badge,
  title,
  subtitle,
  highlights,
  children,
  footer,
}: ClerkAuthFrameProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.18),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,#050505_0%,#09090b_48%,#050505_100%)] px-4 py-10 text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:p-10">
          <div className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-300">
            {badge ?? "Clerk Auth"}
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-zinc-400">
            {subtitle}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {highlights.map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-white/8 bg-black/20 p-4 text-sm text-zinc-300"
              >
                {item}
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            Clerk manages sessions, verification, MFA, OAuth, and account recovery here while NexusAI keeps ownership,
            billing, and authorization data in Prisma.
          </div>

          <div className="mt-6 text-sm text-zinc-500">
            Need a different path?{" "}
            <Link href="/pricing" className="font-medium text-violet-300 hover:text-violet-200">
              Review plans
            </Link>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full max-w-xl">
            <ClerkLoaded>{children}</ClerkLoaded>
            <ClerkLoading>
              <LoadingState title={title} subtitle={subtitle} />
            </ClerkLoading>
            <ClerkFailed>
              <div className="w-full rounded-[1.75rem] border border-red-500/20 bg-red-500/10 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
                <h2 className="text-xl font-semibold text-white">Clerk could not load</h2>
                <p className="mt-2 text-sm text-red-200">
                  Check your Clerk publishable key, session domain, and OAuth settings, then refresh this page.
                </p>
              </div>
            </ClerkFailed>
            {footer && <div className="mt-6">{footer}</div>}
          </div>
        </section>
      </div>
    </div>
  )
}
