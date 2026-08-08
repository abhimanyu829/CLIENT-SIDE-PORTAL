/**
 * POST /api/auth/verify-phone-otp
 *
 * Verifies the Firebase ID token issued after phone OTP confirmation.
 * Writes User.phone + User.phoneVerified to DB if valid.
 *
 * INDEPENDENT of Clerk — does NOT replace or modify Clerk sessions.
 * Firebase is used ONLY to prove phone ownership before payment.
 *
 * Body: { idToken: string, phone: string }
 * Returns: { success: boolean, phone?: string, verifiedAt?: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { auditLog } from "@/lib/admin-audit"

export async function POST(req: NextRequest) {
  try {
    // Must be logged in via Clerk
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { idToken, phone } = body as { idToken?: string; phone?: string }

    if (!idToken || !phone) {
      return NextResponse.json(
        { success: false, error: "idToken and phone are required" },
        { status: 400 }
      )
    }

    // E.164 format check
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Invalid phone format. Use E.164 e.g. +919876543210" },
        { status: 400 }
      )
    }

    // Verify Firebase ID token server-side
    let decodedToken: import("firebase-admin/auth").DecodedIdToken
    try {
      // Dynamic import so build doesn't fail when FIREBASE_ADMIN_* keys are absent
      const { adminAuth } = await import("@/lib/firebase-admin")
      decodedToken = await adminAuth.verifyIdToken(idToken)
    } catch (firebaseErr: any) {
      console.error("[verify-phone-otp] Firebase token verification failed:", firebaseErr?.message)
      return NextResponse.json(
        { success: false, error: "OTP verification failed. Please try again." },
        { status: 400 }
      )
    }

    // Ensure the token's phone_number matches what the client submitted
    if (decodedToken.phone_number !== phone) {
      return NextResponse.json(
        { success: false, error: "Phone number mismatch." },
        { status: 400 }
      )
    }

    const verifiedAt = new Date()

    // Write to DB (non-breaking — fields already exist on User model)
    await db.user.update({
      where: { id: session.user.id },
      data: {
        phone,
        phoneVerified: verifiedAt,
      },
    })

    // Audit trail
    await auditLog({
      userId: session.user.id,
      action: "PHONE_OTP_VERIFIED",
      entity: "User",
      entityId: session.user.id,
      after: { phone, verifiedAt },
    })

    return NextResponse.json({
      success: true,
      phone,
      verifiedAt: verifiedAt.toISOString(),
    })
  } catch (err) {
    console.error("[verify-phone-otp] Unexpected error:", err)
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 })
  }
}
