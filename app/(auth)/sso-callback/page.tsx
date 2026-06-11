"use client"

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs"
import { useEffect } from "react"

export default function SSOCallback() {
  // After the Clerk callback handler completes and the session is established,
  // sync our internal DB record. We do this in a useEffect so it fires only
  // on the client, after Clerk has finished setting the session cookie.
  useEffect(() => {
    // Kick off a best-effort db sync. Errors here are non-fatal —
    // the webhook will eventually reconcile if this fails.
    fetch("/api/auth/clerk-sync", { method: "POST" }).catch(() => {})
  }, [])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-gray-600 font-medium text-lg">Completing sign in...</p>
      </div>
      {/* 
        forceRedirectUrl: where to go after sign-in completes (Clerk v5+)
        signUpForceRedirectUrl: where to go after sign-up completes
        Both replace the deprecated afterSignInUrl / afterSignUpUrl props.
      */}
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
      />
    </div>
  )
}
