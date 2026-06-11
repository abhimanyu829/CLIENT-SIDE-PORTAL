"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useSignIn } from "@clerk/nextjs"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

const emailSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
})

const resetSchema = z.object({
  code: z.string().min(6, { message: "Code must be at least 6 characters" }),
  newPassword: z.string().min(8, { message: "Password must be at least 8 characters" }),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type EmailFormValues = z.infer<typeof emailSchema>
type ResetFormValues = z.infer<typeof resetSchema>

export default function ForgotPasswordPage() {
  // @ts-ignore — Clerk useSignIn types are overly strict; isLoaded exists at runtime
  const { signIn, isLoaded } = useSignIn() as any
  const [stage, setStage] = useState<"email" | "reset" | "done">("email")
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
  })

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  })

  const onRequestReset = async (data: EmailFormValues) => {
    if (!isLoaded || !signIn) return
    setError(null)

    try {
      // @ts-ignore — 'reset_password_email_code' is valid at runtime but not in narrow SDK types
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: data.email,
      })
      setStage("reset")
      setMessage("Check your email for a reset code.")
    } catch (err: any) {
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].longMessage || "Failed to send reset email")
      } else {
        setError("Failed to send reset email. Please try again.")
      }
    }
  }

  const onResetPassword = async (data: ResetFormValues) => {
    if (!isLoaded || !signIn) return
    setError(null)

    try {
      // @ts-ignore — attemptFirstFactor exists at runtime on the SignIn resource
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: data.code,
        password: data.newPassword,
      })

      if (result.status === "complete") {
        setStage("done")
        setMessage("Your password has been reset successfully.")
      } else {
        setError("Something went wrong. Please try again.")
      }
    } catch (err: any) {
      if (err.errors && err.errors.length > 0) {
        setError(err.errors[0].longMessage || "Invalid or expired code")
      } else {
        setError("Invalid or expired reset code.")
      }
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-xl shadow-lg border border-gray-100">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {stage === "done" ? "Password Reset!" : "Forgot Password"}
          </h1>
          <p className="text-sm text-gray-500">
            {stage === "email" && "Enter your email and we'll send you a reset code."}
            {stage === "reset" && "Enter the code from your email and your new password."}
            {stage === "done" && "You can now log in with your new password."}
          </p>
        </div>

        {message && (
          <div className="p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md">
            {message}
          </div>
        )}

        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 border border-red-200 rounded-md">
            {error}
          </div>
        )}

        {stage === "email" && (
          <form onSubmit={emailForm.handleSubmit(onRequestReset)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="name@example.com"
                {...emailForm.register("email")}
              />
              {emailForm.formState.errors.email && (
                <p className="text-sm text-red-500">{emailForm.formState.errors.email.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={emailForm.formState.isSubmitting || !isLoaded}
            >
              {emailForm.formState.isSubmitting ? "Sending..." : "Send Reset Code"}
            </Button>
          </form>
        )}

        {stage === "reset" && (
          <form onSubmit={resetForm.handleSubmit(onResetPassword)} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Reset Code</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="123456"
                {...resetForm.register("code")}
              />
              {resetForm.formState.errors.code && (
                <p className="text-sm text-red-500">{resetForm.formState.errors.code.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="••••••••"
                {...resetForm.register("newPassword")}
              />
              {resetForm.formState.errors.newPassword && (
                <p className="text-sm text-red-500">{resetForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">Confirm Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all"
                placeholder="••••••••"
                {...resetForm.register("confirmPassword")}
              />
              {resetForm.formState.errors.confirmPassword && (
                <p className="text-sm text-red-500">{resetForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={resetForm.formState.isSubmitting || !isLoaded}
            >
              {resetForm.formState.isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-gray-500 hover:text-gray-900 underline"
              onClick={() => { setStage("email"); setError(null); setMessage(null); }}
            >
              Send a new code
            </button>
          </form>
        )}

        {stage === "done" && (
          <div className="text-center">
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
          </div>
        )}

        {stage !== "done" && (
          <p className="text-sm text-center text-gray-600">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-black hover:underline">
              Log in
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
