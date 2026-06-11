"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function VerifyPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyContent />
    </Suspense>
  )
}

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  )
  const [errorMessage, setErrorMessage] = useState("")
  const [isExpired, setIsExpired] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMessage, setResendMessage] = useState("")

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setErrorMessage("No verification token provided.")
      return
    }

    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const data = await r.json()
        if (r.ok) {
          setStatus("success")
          setTimeout(() => router.push("/login?verified=true"), 3000)
        } else {
          setStatus("error")
          setErrorMessage(data.error || "Verification failed")
          setIsExpired(data.expired === true)
        }
      })
      .catch(() => {
        setStatus("error")
        setErrorMessage("An unexpected error occurred.")
      })
  }, [token, router])

  const handleResend = async () => {
    setResending(true)
    setResendMessage("")
    try {
      // Prompt user for email since we may not have it
      const email = prompt("Enter your email address:")
      if (!email) {
        setResending(false)
        return
      }

      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (response.ok) {
        setResendMessage(data.message || "Verification email sent! Check your inbox.")
      } else {
        setResendMessage(data.error || "Failed to resend. Please try again.")
      }
    } catch {
      setResendMessage("Failed to resend. Please try again.")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-gray-100 text-center">
        {status === "loading" && (
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 border-4 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
            <h1 className="text-2xl font-bold text-gray-900">
              Verifying your email...
            </h1>
            <p className="text-sm text-gray-500">Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Email Verified!
            </h1>
            <p className="text-sm text-gray-500">
              Your email has been verified successfully. Redirecting to login...
            </p>
            <Link
              href="/login"
              className="inline-block text-sm font-medium text-indigo-600 hover:underline"
            >
              Go to login now →
            </Link>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              Verification Failed
            </h1>
            <p className="text-sm text-gray-500">{errorMessage}</p>

            {resendMessage && (
              <p className="text-sm text-indigo-600 bg-indigo-50 p-3 rounded-md">
                {resendMessage}
              </p>
            )}

            {isExpired && (
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full"
              >
                {resending
                  ? "Sending..."
                  : "Request New Verification Email"}
              </Button>
            )}

            {/* Spam/Promotions notice */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-left">
              <p className="text-xs font-medium text-blue-800">
                Not seeing the email?
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Check your <strong>Spam</strong>, <strong>Promotions</strong>, or{" "}
                <strong>Updates</strong> folders. Email delivery may take a few minutes.
              </p>
            </div>

            <div className="space-y-2">
              <Link
                href="/login"
                className="block text-sm font-medium text-indigo-600 hover:underline"
              >
                Back to login
              </Link>
              <Link
                href="/register"
                className="block text-sm text-gray-500 hover:underline"
              >
                Create a new account
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}