import { db } from "@/lib/db"

export const CURRENT_TERMS_VERSION = "2026-05-21-v2.4"
export const CURRENT_PRIVACY_VERSION = "2026-05-21-v2.4"
export const COOKIE_PREF_VERSION = "v1"

export function isSafeReturnUrl(v: string | null | undefined): string | null {
  if (!v || typeof v !== "string") return null
  if (!v.startsWith("/") || v.startsWith("//")) return null
  if (v.includes("://") || v.includes("\\")) return null
  try {
    const u = new URL(v, "http://x")
    if (u.host !== "x") return null
  } catch { return null }
  return v
}

export async function hasAcceptedCurrentLegal(userId: string): Promise<boolean> {
  const c = await db.legalConsent.findUnique({ where: { userId } }).catch(() => null)
  if (!c) return false
  return c.termsVersion === CURRENT_TERMS_VERSION && c.privacyVersion === CURRENT_PRIVACY_VERSION
}

export async function recordLegalConsent(userId: string, meta: { ip?: string | null; userAgent?: string | null }) {
  return db.legalConsent.upsert({
    where: { userId },
    create: { userId, termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, acceptedAt: new Date(), ip: meta.ip ?? null, userAgent: meta.userAgent ?? null },
    update: { termsVersion: CURRENT_TERMS_VERSION, privacyVersion: CURRENT_PRIVACY_VERSION, acceptedAt: new Date(), ip: meta.ip ?? null, userAgent: meta.userAgent ?? null },
  })
}
