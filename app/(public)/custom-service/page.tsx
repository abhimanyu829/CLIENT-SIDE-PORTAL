import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { getCustomServicePortalSetting } from "@/lib/custom-service-portal"
import { CustomServiceRequestForm } from "@/components/custom-service/CustomServiceRequestForm"
import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function CustomServicePage() {
  let setting: Awaited<ReturnType<typeof getCustomServicePortalSetting>> | null = null
  let session: Awaited<ReturnType<typeof auth>> = null

  try {
    setting = await getCustomServicePortalSetting()
  } catch {
    setting = null
  }

  try {
    session = await auth()
  } catch {
    session = null
  }

  if (!setting) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Service requests are temporarily unavailable</h1>
          <p className="mt-3 text-muted-foreground">Please check back soon.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-all">
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  if (setting.publicPath === "/request-service") redirect("/request-service")

  if (!setting.isEnabled) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <Clock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Service requests are temporarily unavailable</h1>
          <p className="mt-3 text-muted-foreground">Please check back soon.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-all">
            Back to home
          </Link>
        </div>
      </main>
    )
  }

  // Not logged in — redirect to login
  if (!session?.user) {
    return (
      <main className="min-h-screen bg-background">
        <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-background to-background dark:from-amber-950/20 px-6 py-24 sm:py-32 text-center">
          <div className="absolute inset-0 pointer-events-none" aria-hidden>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-amber-400/10 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-1.5 text-xs font-semibold text-amber-700 mb-6">
              <Sparkles className="w-3.5 h-3.5" /> Custom Software Development
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
              Let&apos;s build your<br />
              <span className="text-amber-700">next big idea</span>
            </h1>
            <p className="mt-5 text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Share your idea and we&apos;ll open a private discussion with the NexusAI team immediately after submission.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login?callbackUrl=/custom-service"
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-700 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-amber-700/25 hover:bg-amber-800 transition-all"
              >
                Get started free <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register?callbackUrl=/custom-service"
                className="inline-flex items-center gap-2 rounded-2xl border border-border bg-card px-7 py-3.5 text-sm font-semibold text-foreground hover:bg-muted transition-all"
              >
                Create account
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  // Authenticated — show form
  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-gradient-to-b from-amber-50 via-background to-background dark:from-amber-950/20 px-6 py-16 sm:py-20 text-center">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full bg-amber-400/10 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 px-4 py-1.5 text-xs font-semibold text-amber-700 mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Custom Development Portal
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Let&apos;s build your next solution
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Share your idea, business challenge, or software requirements.
            You&apos;ll get a private discussion space with the NexusAI team right after you submit.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {["Private & secure", "Fast response", "No commitment required"].map((item) => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 sm:px-6 pb-24">
        <div className="rounded-3xl border border-border bg-card shadow-sm p-6 md:p-10">
          <CustomServiceRequestForm
            name={session.user.name ?? ""}
            email={session.user.email ?? ""}
          />
        </div>
      </section>
    </main>
  )
}
