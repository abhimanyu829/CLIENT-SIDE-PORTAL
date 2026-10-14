"use client"
import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { COOKIE_PREF_VERSION } from "@/lib/legal-consent"

const KEY = `cookie_prefs_${COOKIE_PREF_VERSION}`
/** Window event any opener dispatches to bring the single preferences dialog back up. */
export const COOKIE_PREFS_OPEN_EVENT = "cookie-prefs:open"

type Prefs = { analytics: boolean; marketing: boolean }

function readLocal(): Prefs | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    if (j.v !== COOKIE_PREF_VERSION) return null
    return { analytics: !!j.a, marketing: !!j.m }
  } catch { return null }
}

function writeLocal(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ v: COOKIE_PREF_VERSION, a: p.analytics ? 1 : 0, m: p.marketing ? 1 : 0 }))
  } catch {
    /* localStorage unavailable (private mode) — the cookie below is authoritative */
  }
}

/**
 * Re-open control for cookie preferences. Renders only a button and never a
 * dialog, so it is safe to place in multiple locations (footer, auth page)
 * without producing duplicate banners.
 */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") window.dispatchEvent(new Event(COOKIE_PREFS_OPEN_EVENT))
      }}
      className={className ?? "text-xs text-muted-foreground underline underline-offset-4"}
    >
      Cookie preferences
    </button>
  )
}

export function CookieConsentCard({ compact = false }: { compact?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [manage, setManage] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [pending, start] = useTransition()

  useEffect(() => {
    if (compact) return
    const local = readLocal()
    const hasCookie = typeof document !== "undefined" && document.cookie.includes("cookie_prefs=")
    if (!hasCookie && !local) setVisible(true)
    if (local) { setAnalytics(local.analytics); setMarketing(local.marketing) }
  }, [compact])

  // Any CookiePreferencesButton on the page (re)opens this single dialog.
  useEffect(() => {
    if (compact) return
    const open = () => { setManage(false); setVisible(true) }
    window.addEventListener(COOKIE_PREFS_OPEN_EVENT, open)
    return () => window.removeEventListener(COOKIE_PREFS_OPEN_EVENT, open)
  }, [compact])

  const persist = useCallback((p: Prefs) => {
    const val = encodeURIComponent(JSON.stringify({ v: COOKIE_PREF_VERSION, a: p.analytics ? 1 : 0, m: p.marketing ? 1 : 0 }))
    document.cookie = `cookie_prefs=${val}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`
    writeLocal(p)
    start(async () => {
      await fetch("/api/cookie-prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(p) }).catch(() => {})
    })
  }, [start])

  function acceptAll() { persist({ analytics: true, marketing: true }); setVisible(false) }
  function rejectOptional() { persist({ analytics: false, marketing: false }); setVisible(false) }
  function saveManage() { persist({ analytics, marketing }); setVisible(false); setManage(false) }

  // compact instances are openers only — they must never render a second dialog.
  if (compact) return <CookiePreferencesButton />

  if (!visible) return null

  return (
    <div role="dialog" aria-modal="false" aria-label="Cookie preferences" className="fixed inset-x-0 bottom-0 z-[9998] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-2xl">
        <h2 className="text-sm font-semibold text-foreground">Cookie preferences</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          We use essential cookies to keep you signed in and secure. Optional analytics/marketing cookies help improve the site; they only run after you accept. Manage choices anytime via <Link href="/cookies" className="text-primary underline underline-offset-4">Cookie Policy</Link>.
        </p>
        {!manage ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={acceptAll} disabled={pending}>Accept all</Button>
            <Button variant="outline" onClick={rejectOptional} disabled={pending}>Reject optional</Button>
            <Button variant="ghost" onClick={() => setManage(true)}>Manage preferences</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-3 text-sm"><Checkbox checked disabled /> Essential — always on (auth, security)</label>
            <label className="flex items-center gap-3 text-sm cursor-pointer"><Checkbox checked={analytics} onCheckedChange={(v) => setAnalytics(!!v)} /> Analytics</label>
            <label className="flex items-center gap-3 text-sm cursor-pointer"><Checkbox checked={marketing} onCheckedChange={(v) => setMarketing(!!v)} /> Marketing</label>
            <div className="flex gap-2">
              <Button onClick={saveManage} disabled={pending}>Save preferences</Button>
              <Button variant="ghost" onClick={() => setManage(false)}>Back</Button>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Rejecting optional cookies does not block marketplace access after login and required Terms/Privacy acceptance.</p>
      </div>
    </div>
  )
}
