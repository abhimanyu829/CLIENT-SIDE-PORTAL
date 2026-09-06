import crypto from "crypto"
import { redis } from "@/lib/redis"
import { env } from "@/lib/env"

const OTP_EXPIRY = (env.OTP_EXPIRY_MINUTES ?? 10) * 60
const MAX_ATTEMPTS = 5
const SEND_COOLDOWN = 60

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString()
}

/**
 * E.164 phone normalization — the canonical format every layer agrees on:
 * "+<digits>", max 15 digits (Twilio's limit). Returns null when invalid.
 */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) return null
  return trimmed
}

function otpKey(userId: string): string {
  return `otp:${userId}`
}

function otpAttemptsKey(userId: string): string {
  return `otp:attempts:${userId}`
}

function otpCooldownKey(userId: string): string {
  return `otp:cooldown:${userId}`
}

/** Hash comparison that does not leak match position through timing. */
function safeEqualHash(stored: string, computed: string): boolean {
  const a = Buffer.from(stored, "utf8")
  const b = Buffer.from(computed, "utf8")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function storeOtp(userId: string, code: string, phone: string): Promise<void> {
  const hash = crypto.createHash("sha256").update(code).digest("hex")

  if (redis) {
    // Bind the OTP to the phone it was sent to — verify must present the same
    // phone or the code is rejected (prevents proving number X but persisting Y).
    await redis.set(otpKey(userId), `${phone}:${hash}`, { ex: OTP_EXPIRY })
    await redis.del(otpAttemptsKey(userId))
  } else {
    const { db } = await import("@/lib/db")
    await db.user.update({
      where: { id: userId },
      data: {
        otpCode: hash,
        otpExpiresAt: new Date(Date.now() + OTP_EXPIRY * 1000),
        // Bind the OTP to the phone it was sent to and reset attempt state
        otpPhone: phone,
        otpAttempts: 0,
      },
    })
  }
}

/**
 * Atomically records one verify attempt on the DB-fallback path.
 * Returns false when the attempt budget is exhausted — the caller must
 * reject without touching the stored hash.
 */
async function recordDbAttempt(userId: string): Promise<boolean> {
  const { db } = await import("@/lib/db")
  // Single conditional increment — only succeeds while under the cap.
  const updated = await db.user.updateMany({
    where: { id: userId, otpAttempts: { lt: MAX_ATTEMPTS } },
    data: { otpAttempts: { increment: 1 } },
  })
  return updated.count > 0
}

export async function verifyOtp(userId: string, code: string, phone: string): Promise<boolean> {
  const hash = crypto.createHash("sha256").update(code).digest("hex")

  // ── Attempt budget ────────────────────────────────────────────────────
  if (redis) {
    const count = await redis.incr(otpAttemptsKey(userId))
    await redis.expire(otpAttemptsKey(userId), OTP_EXPIRY)
    if (count > MAX_ATTEMPTS) {
      throw new Error("Too many failed attempts. Please wait and try again.")
    }
  } else {
    const attemptOk = await recordDbAttempt(userId)
    if (!attemptOk) {
      throw new Error("Too many failed attempts. Please wait and try again.")
    }
  }

  // ── Redis path ────────────────────────────────────────────────────────
  if (redis) {
    const stored = await redis.get<string>(otpKey(userId))
    if (!stored) return false
    const separatorIndex = stored.indexOf(":")
    if (separatorIndex === -1) return false
    const storedPhone = stored.slice(0, separatorIndex)
    const storedHash = stored.slice(separatorIndex + 1)
    // The OTP must match the phone it was sent to.
    if (storedPhone !== phone) return false
    if (!safeEqualHash(storedHash, hash)) return false
    await redis.del(otpKey(userId))
    await redis.del(otpAttemptsKey(userId))
    return true
  }

  // ── DB-fallback path ──────────────────────────────────────────────────
  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { otpCode: true, otpExpiresAt: true, otpPhone: true },
  })

  if (!user?.otpCode || !user?.otpExpiresAt) return false
  if (user.otpExpiresAt.getTime() < Date.now()) return false
  // The OTP must match the phone it was sent to — prevents verifying a code
  // that was issued for a different number.
  if (!user.otpPhone || user.otpPhone !== phone) return false
  if (!safeEqualHash(user.otpCode, hash)) return false

  // Consume the OTP in the same update that marks the phone verified.
  await db.user.update({
    where: { id: userId },
    data: {
      otpCode: null,
      otpExpiresAt: null,
      otpPhone: null,
      otpAttempts: 0,
    },
  })

  return true
}

export async function checkSendCooldown(userId: string): Promise<boolean> {
  if (redis) {
    const exists = await redis.exists(otpCooldownKey(userId))
    return exists === 1
  }

  // DB fallback: cooldown window measured from the last send, not from the
  // OTP expiry (the old code compared against a future timestamp and never
  // actually throttled resends).
  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { otpLastSentAt: true },
  })

  if (!user?.otpLastSentAt) return false

  const elapsed = (Date.now() - user.otpLastSentAt.getTime()) / 1000
  return elapsed < SEND_COOLDOWN
}

export async function setSendCooldown(userId: string): Promise<void> {
  if (redis) {
    await redis.set(otpCooldownKey(userId), "1", { ex: SEND_COOLDOWN })
    return
  }
  const { db } = await import("@/lib/db")
  await db.user.update({
    where: { id: userId },
    data: { otpLastSentAt: new Date() },
  })
}

export async function getRemainingAttempts(userId: string): Promise<number> {
  if (redis) {
    const count = await redis.get<number>(otpAttemptsKey(userId))
    return Math.max(0, MAX_ATTEMPTS - (count ?? 0))
  }
  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { otpAttempts: true },
  })
  return Math.max(0, MAX_ATTEMPTS - (user?.otpAttempts ?? 0))
}
