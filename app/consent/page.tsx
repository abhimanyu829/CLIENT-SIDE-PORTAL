import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, hasAcceptedCurrentLegal, isSafeReturnUrl } from "@/lib/legal-consent"
import { LegalConsentCard } from "@/components/consent/LegalConsentCard"
import Link from "next/link"

export default async function ConsentPage({ searchParams }: { searchParams?: Promise<{ returnTo?: string }> }) {
  const sp = await searchParams
  const rawReturn = sp?.returnTo ?? "/marketplace"
  const returnTo = isSafeReturnUrl(rawReturn) ?? "/marketplace"
  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=${encodeURIComponent(`/consent?returnTo=${encodeURIComponent(returnTo)}`)}`)
  const ok = await hasAcceptedCurrentLegal(session.user.id)
  if (ok) redirect(returnTo)

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Accept Terms & Privacy</h1>
          <p className="mt-1 text-sm text-muted-foreground">Required before marketplace access. Versions: Terms {CURRENT_TERMS_VERSION} · Privacy {CURRENT_PRIVACY_VERSION}</p>
          <p className="mt-1 text-xs text-muted-foreground"><Link href="/terms" className="underline underline-offset-4">Terms</Link> · <Link href="/privacy" className="underline underline-offset-4">Privacy</Link> · <Link href="/cookies" className="underline underline-offset-4">Cookies</Link></p>
        </div>
        <LegalConsentCard />
        <p className="text-center text-xs text-muted-foreground">After acceptance you return to {returnTo}.</p>
      </div>
    </div>
  )
}
