/**
 * Phone number submission validation for payment-order creation.
 *
 * Phone OTP verification has been removed per requirement: phone number
 * is submission-only (contact info for delivery/communication).
 * Email OTP verification remains strictly required and enforced at DB level.
 */
import { db } from "@/lib/db"

export interface PhoneGateInput {
  /** Authenticated user id */
  userId: string
  /** The billing mobile submitted with the order request. */
  billingMobile?: unknown
}

export interface PhoneGateResult {
  verified: boolean
  code?: "PHONE_NOT_VERIFIED"
  message?: string
}

/**
 * Validates that a valid phone number is submitted with the billing details.
 * Persists the mobile number to user profile and returns { verified: true }.
 */
export async function requireVerifiedPhoneForPayment({
  userId,
  billingMobile,
}: PhoneGateInput): Promise<PhoneGateResult> {
  const rawMobile = typeof billingMobile === "string" ? billingMobile.trim().replace(/[\s-]/g, "") : ""
  if (!rawMobile || rawMobile.length < 7) {
    return {
      verified: false,
      code: "PHONE_NOT_VERIFIED",
      message: "A valid phone number is required in the billing details before payment.",
    }
  }

  // Persist submitted phone number to user record
  await db.user.update({
    where: { id: userId },
    data: { phone: rawMobile },
  }).catch(() => {})

  return { verified: true }
}
