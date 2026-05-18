import Razorpay from "razorpay"

let _razorpay: Razorpay | null = null

/**
 * Lazily-initialized Razorpay client.
 * Returns null if keys are not configured (safe to check before use).
 * This pattern prevents build-time crashes when env vars are absent.
 */
export function getRazorpay(): Razorpay | null {
  if (_razorpay) return _razorpay

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    return null
  }

  _razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret })
  return _razorpay
}

/**
 * Named export for backwards-compatibility with existing imports.
 * NOTE: May return null — always check before use.
 */
export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    const client = getRazorpay()
    if (!client) {
      // Return a no-op function to prevent crashes when keys not set
      return () => Promise.reject(new Error("Razorpay is not configured"))
    }
    return (client as any)[prop]
  },
})
