import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

/**
 * POST /api/enquiries
 *
 * Minimal public enquiry intake for the website (contact, enterprise,
 * affiliate interest, press). Stores a Lead row with a server-derived source —
 * real site forms cannot write arbitrary CRM stages and never receive CRM data
 * back. Compliant with the existing Lead model; no payment, auth, or
 * subscription behaviour is touched.
 */

const CATEGORIES = new Set([
  "product-pricing",
  "custom-software-ai",
  "enterprise",
  "technical-support",
  "billing-subscription",
  "affiliate-partnership",
  "privacy-legal",
  "press-media",
])

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export async function POST(req: Request) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 })
  }

  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")
  const name = str(body.name, 120)
  const email = str(body.email, 200)
  const organization = str(body.organization, 160)
  const category = str(body.category, 40)
  const message = str(body.message, 4000)
  const honeypot = str(body.website, 100) // must stay empty

  // Honeypot: pretend success to bots, never write.
  if (honeypot) {
    return NextResponse.json({ ok: true })
  }

  if (!name || name.length < 2) {
    return NextResponse.json({ ok: false, error: "Please provide your name." }, { status: 400 })
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Please provide a valid email address." }, { status: 400 })
  }
  if (!CATEGORIES.has(category)) {
    return NextResponse.json({ ok: false, error: "Please choose a valid enquiry category." }, { status: 400 })
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ ok: false, error: "Please describe your enquiry in a little more detail." }, { status: 400 })
  }

  // Light fixed-window throttle per email (in addition to the platform-wide
  // Upstash limiter in proxy.ts). Fails open only when Redis is not configured.
  if (redis) {
    try {
      const key = `enquiry:${email.toLowerCase()}`
      const count = await redis.incr(key)
      if (count === 1) await redis.expire(key, 600)
      if (count > 5) {
        return NextResponse.json({ ok: false, error: "Too many enquiries from this address. Please try again later." }, { status: 429 })
      }
    } catch {
      // Do not block a legitimate enquiry because the limiter is unavailable.
    }
  }

  try {
    await db.lead.create({
      data: {
        email,
        name,
        company: organization || null,
        source: `website:${category}`,
        stage: "NEW",
        score: 0,
        notes: message,
      },
    })
  } catch (err) {
    logger.error({ err, category }, "enquiry intake failed")
    return NextResponse.json({ ok: false, error: "We could not record your enquiry. Please try again shortly." }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}