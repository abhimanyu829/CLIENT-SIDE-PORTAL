import crypto from "crypto"
import { redis } from "@/lib/redis"
import { env } from "@/lib/env"

const OTP_EXPIRY = (env.OTP_EXPIRY_MINUTES ?? 10) * 60
const MAX_ATTEMPTS = 5
const SEND_COOLDOWN = 60

export function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString()
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

export async function storeOtp(userId: string, code: string): Promise<void> {
  const hash = crypto.createHash("sha256").update(code).digest("hex")

  if (redis) {
    await redis.set(otpKey(userId), hash, { ex: OTP_EXPIRY })
    await redis.del(otpAttemptsKey(userId))
  } else {
    const { db } = await import("@/lib/db")
    await db.user.update({
      where: { id: userId },
      data: {
        otpCode: hash,
        otpExpiresAt: new Date(Date.now() + OTP_EXPIRY * 1000),
      },
    })
  }
}

export async function verifyOtp(userId: string, code: string): Promise<boolean> {
  const hash = crypto.createHash("sha256").update(code).digest("hex")

  const attempts = await incrementAttempts(userId)
  if (attempts > MAX_ATTEMPTS) {
    throw new Error("Too many failed attempts. Please wait and try again.")
  }

  if (redis) {
    const stored = await redis.get<string>(otpKey(userId))
    if (!stored) return false
    if (stored !== hash) return false
    await redis.del(otpKey(userId))
    await redis.del(otpAttemptsKey(userId))
    return true
  }

  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { otpCode: true, otpExpiresAt: true },
  })

  if (!user?.otpCode || !user?.otpExpiresAt) return false
  if (user.otpExpiresAt.getTime() < Date.now()) return false
  if (user.otpCode !== hash) return false

  await db.user.update({
    where: { id: userId },
    data: { otpCode: null, otpExpiresAt: null },
  })

  return true
}

export async function checkSendCooldown(userId: string): Promise<boolean> {
  if (redis) {
    const exists = await redis.exists(otpCooldownKey(userId))
    return exists === 1
  }

  const { db } = await import("@/lib/db")
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { otpExpiresAt: true },
  })

  if (!user?.otpExpiresAt) return false

  const elapsed = (Date.now() - user.otpExpiresAt.getTime()) / 1000
  const initialExpirySeconds = OTP_EXPIRY
  return elapsed < SEND_COOLDOWN
}

export async function setSendCooldown(userId: string): Promise<void> {
  if (redis) {
    await redis.set(otpCooldownKey(userId), "1", { ex: SEND_COOLDOWN })
  }
}

async function incrementAttempts(userId: string): Promise<number> {
  if (redis) {
    const count = await redis.incr(otpAttemptsKey(userId))
    await redis.expire(otpAttemptsKey(userId), OTP_EXPIRY)
    return count
  }
  return 0
}

export async function getRemainingAttempts(userId: string): Promise<number> {
  if (redis) {
    const count = await redis.get<number>(otpAttemptsKey(userId))
    return Math.max(0, MAX_ATTEMPTS - (count ?? 0))
  }
  return MAX_ATTEMPTS
}
