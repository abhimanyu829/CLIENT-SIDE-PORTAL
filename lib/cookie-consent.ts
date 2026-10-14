import { COOKIE_PREF_VERSION } from "@/lib/legal-consent"

export type CookiePrefs = { analytics: boolean; marketing: boolean; essential: true }
export const DEFAULT_COOKIE_PREFS: CookiePrefs = { essential: true, analytics: false, marketing: false }

export const COOKIE_NAME = "cookie_prefs"
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function parseCookiePrefs(raw: string | undefined | null): CookiePrefs | null {
  if (!raw) return null
  try {
    const j = JSON.parse(decodeURIComponent(raw))
    if (j.v !== COOKIE_PREF_VERSION) return null
    return { essential: true, analytics: !!j.a, marketing: !!j.m }
  } catch { return null }
}

export function serializeCookiePrefs(p: CookiePrefs): string {
  return encodeURIComponent(JSON.stringify({ v: COOKIE_PREF_VERSION, a: p.analytics ? 1 : 0, m: p.marketing ? 1 : 0 }))
}
