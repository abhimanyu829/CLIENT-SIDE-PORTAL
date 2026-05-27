import Razorpay from "razorpay"
import { env } from "@/lib/env"

let _razorpay: Razorpay | null = null

/**
 * Lazily-initialized Razorpay client.
 * Returns null if keys are not configured (safe to check before use).
 * Uses validated env from lib/env.ts — never raw process.env.
 */
export function getRazorpay(): Razorpay | null {
  if (_razorpay) return _razorpay

  const keyId = env.RAZORPAY_KEY_ID
  const keySecret = env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    console.error("[RAZORPAY] ❌ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not configured. Payment creation will fail.")
    return null
  }

  console.log(`[RAZORPAY] ✅ Initializing Razorpay client with key: ${keyId.slice(0, 8)}...`)
  _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  return _razorpay
}

/**
 * Reset the cached Razorpay instance (useful after env changes).
 */
export function resetRazorpay() {
  _razorpay = null
}

/**
 * Named export for backwards-compatibility with existing imports.
 * NOTE: May return null — always check before use.
 */
export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    const client = getRazorpay()
    if (!client) {
      return () => Promise.reject(new Error("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"))
    }
    return (client as any)[prop]
  },
})