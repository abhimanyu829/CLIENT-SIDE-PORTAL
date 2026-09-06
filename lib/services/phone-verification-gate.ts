/**
 * Phone-verification gate for payment-order creation.
 *
 * Mirrors the BillingEmailOtp gate precedent in the razorpay/phonepe/paytm
 * order routes: the server checks its OWN database — User.phoneVerified plus
 * a match between User.phone and the billing mobile — and never trusts any
 * client-sent verification flag.
 *
 * Both existing verification writers (Twilio /api/auth/otp/* and the
 * Firebase /api/auth/verify-phone-otp route) persist exactly these fields,
 * so this gate honors either system without modifying either.
 */
import { db } from "@/lib/db"
import { normalizePhone } from "@/lib/otp"

export interface PhoneGateInput {
  /** Authenticated user id — the row that must actually be verified. */
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
 * Returns { verified: true } when the user has a phoneVerified timestamp AND
 * the verified number matches the billing mobile. Any mismatch, missing
 * verification, or malformed input fails CLOSED with a 403-shaped payload.
 */
export async function requireVerifiedPhoneForPayment({
  userId,
  billingMobile,
}: PhoneGateInput): Promise<PhoneGateResult> {
  const mobile = typeof billingMobile === "string" ? normalizePhone(billingMobile) : null
  if (!mobile) {
    return {
      verified: false,
      code: "PHONE_NOT_VERIFIED",
      message: "A verified phone number is required before payment. Please verify the mobile number in the billing step.",
    }
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { phone: true, phoneVerified: true },
  })

  if (!user?.phoneVerified) {
    return {
      verified: false,
      code: "PHONE_NOT_VERIFIED",
      message: "Phone verification is required before payment. Please complete OTP verification in the billing step.",
    }
  }

  const verifiedPhone = normalizePhone(user.phone ?? "")
  if (!verifiedPhone || verifiedPhone !== mobile) {
    // The billing mobile differs from the verified number — force
    // re-verification rather than accepting an unverified number.
    return {
      verified: false,
      code: "PHONE_NOT_VERIFIED",
      message: "The billing mobile number does not match your verified phone. Please verify the new number via OTP before payment.",
    }
  }

  return { verified: true }
}
