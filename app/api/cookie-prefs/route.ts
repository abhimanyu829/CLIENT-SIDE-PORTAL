import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { COOKIE_NAME, COOKIE_MAX_AGE } from "@/lib/cookie-consent"
import { COOKIE_PREF_VERSION } from "@/lib/legal-consent"

function serialize(a: boolean, m: boolean) {
  return encodeURIComponent(JSON.stringify({ v: COOKIE_PREF_VERSION, a: a ? 1 : 0, m: m ? 1 : 0 }))
}

export async function GET(req: Request) {
  const raw = (req as any).headers?.get?.("cookie") ?? ""
  const m = raw.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))
  const val = m?.[1] ?? null
  return NextResponse.json({ cookie: val })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any))
  const analytics = !!body.analytics
  const marketing = !!body.marketing
  const val = serialize(analytics, marketing)
  const session = await auth().catch(() => null)
  const userId = session?.user?.id ?? null

  if (userId) {
    await db.cookiePreference.upsert({
      where: { userId },
      create: { userId, analytics, marketing, version: COOKIE_PREF_VERSION },
      update: { analytics, marketing, version: COOKIE_PREF_VERSION },
    }).catch(() => {})
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(COOKIE_NAME, val, { path: "/", maxAge: COOKIE_MAX_AGE, sameSite: "lax" })
  return res
}
