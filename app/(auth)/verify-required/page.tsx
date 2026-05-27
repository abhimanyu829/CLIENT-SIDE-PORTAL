"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

export default function VerifyRequiredPage() {
  const searchParams = useSearchParams()
  const redirect = searchParams.get("redirect") || "/dashboard"
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState("")
  const [messageType, setMessageType] = useState<"success" | "error">("success")
  const [userEmail, setUserEmail] = useState("")

  useEffect(() => {
    // Try to get user email from session
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((session) => {
        if (session?.user?.email) {
          setUserEmail(session.user.email)
        }
      })
      .catch(() => {
        // Session fetch failed, user can still enter email manually
      })
  }, [])

  const handleResend = async () => {
    setResending(true)
    setMessage("")
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      })
      const data = await response.json()
      if (response.ok) {
        setMessage(data.message || "Verification email sent! Check your inbox.")
        setMessageType("success")
      } else {
        setMessage(data.error || "Failed to send verification email.")
        setMessageType("error")
      }
    } catch {
      setMessage("Failed to send. Please try again.")
      setMessageType("error")
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-gray-100 text-center">
        <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Verify Your Account
        </h1>
        <p className="text-sm text-gray-500">
          You need to verify your email address before continuing. Check your
          inbox for the verification link we sent.
        </p>

        {/* Premium access blocked notice */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
          <p className="text-sm font-medium text-amber-800">
            Premium features locked
          </p>
          <p className="text-xs text-amber-700 mt-1">
            Subscriptions, AI tools, billing, and premium features are unavailable
            until your email is verified.
          </p>
        </div>

        {/* Email input for resend */}
        {!userEmail && (
          <div className="space-y-1 text-left">
            <label className="text-sm font-medium text-gray-700">
              Enter your email to resend verification
            </label>
            <input
              type="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="name@example.com"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
            />
          </div>
        )}

        {userEmail && (
          <p className="text-sm text-gray-600">
            Resending to: <span className="font-medium">{userEmail}</span>
          </p>
        )}

        <Button
          onClick={handleResend}
          disabled={resending || !userEmail}
          variant="outline"
          className="w-full"
        >
          {resending ? "Sending..." : "Resend Verification Email"}
        </Button>

        {message && (
          <p className={`text-sm p-3 rounded-md ${
            messageType === "success"
              ? "text-green-600 bg-green-50"
              : "text-red-500 bg-red-50"
          }`}>
            {message}
          </p>
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
            href={redirect}
            className="block text-sm text-gray-500 hover:underline"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  )
}