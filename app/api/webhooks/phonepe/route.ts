/**
 * POST /api/webhooks/phonepe
 *
 * ARCHITECTURE NOTE (Manual UPI Flow):
 * PhonePe is now configured as a "Direct UPI" manual gateway.
 * Users scan a QR code, pay, and submit their UTR + screenshot.
 * Admins approve via /admin/payments/verifications.
 * Fulfillment is triggered by the admin approval endpoint, NOT this webhook.
 *
 * This route remains as a stub for forward compatibility
 * in case actual PhonePe API integration is added later.
 */
import { NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function POST(req: NextRequest) {
  logger.info(
    "[PHONEPE WEBHOOK] Received — PhonePe is configured as Direct UPI manual gateway. " +
    "Automated webhook fulfillment is not applicable. " +
    "Use /admin/payments/verifications to approve UTR submissions."
  )

  // Return 200 to acknowledge receipt (prevents retry storms from any integration)
  return NextResponse.json({
    received: true,
    note: "PhonePe Direct UPI: fulfillment is handled via admin manual verification. No action taken.",
  })
}
