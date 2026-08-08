/**
 * Firebase Web v9 Modular SDK — CLIENT SIDE ONLY.
 *
 * IMPORTANT: This module is completely independent of Clerk.
 * Firebase is ONLY used for phone OTP verification before payment.
 * It does NOT authenticate users, does NOT replace Clerk sessions,
 * and does NOT connect to any Clerk identity.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, type Auth } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
}

let firebaseApp: FirebaseApp
let firebaseAuth: Auth

// Safe singleton — Next.js hot-reloads can call this multiple times
if (typeof window !== "undefined") {
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  firebaseAuth = getAuth(firebaseApp)
}

export { firebaseAuth }
export default firebaseConfig
