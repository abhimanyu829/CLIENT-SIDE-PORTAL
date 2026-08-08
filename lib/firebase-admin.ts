/**
 * Firebase Admin SDK — SERVER SIDE ONLY.
 *
 * Used exclusively to verify Firebase ID tokens issued after phone OTP.
 * Completely independent of Clerk — does NOT affect user authentication.
 *
 * Set env vars:
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    privateKey
  ) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    })
  } else {
    // Dev fallback — OTP verify route will return an error if keys are missing
    console.warn(
      "[firebase-admin] Missing FIREBASE_ADMIN_* env vars. Phone OTP verification will fail."
    )
  }
}

export const adminAuth = getAuth()
