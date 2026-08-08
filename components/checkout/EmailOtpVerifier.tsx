"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Mail, ShieldCheck, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"

type Phase = "idle" | "sending" | "otp" | "verifying" | "done" | "error"

interface Props {
  email: string
  customerName?: string
  checkoutSessionId: string
  onVerified: (email: string) => void
  onReset?: () => void
}

export default function EmailOtpVerifier({
  email,
  customerName,
  checkoutSessionId,
  onVerified,
  onReset,
}: Props) {
  const [otp, setOtp] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const startCooldown = useCallback((seconds = 60) => {
    setResendCooldown(seconds)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return s - 1
      })
    }, 1000)
  }, [])

  const handleSendOtp = useCallback(async () => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid billing email address before requesting a code.")
      setPhase("error")
      return
    }

    setError(null)
    setPhase("sending")

    try {
      const res = await fetch("/api/auth/billing-email-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, checkoutSessionId, customerName }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error?.message ?? "Failed to send verification code.")
        setPhase("error")
        if (data.cooldownSeconds) startCooldown(data.cooldownSeconds)
        return
      }

      setPhase("otp")
      startCooldown(data.cooldownSeconds ?? 60)
    } catch {
      setError("Network error. Please check your connection and try again.")
      setPhase("error")
    }
  }, [email, checkoutSessionId, customerName, startCooldown])

  const handleVerifyOtp = useCallback(async () => {
    if (!otp.trim()) return
    setError(null)
    setPhase("verifying")

    try {
      const res = await fetch("/api/auth/billing-email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: otp.trim().toUpperCase(), checkoutSessionId, email }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error?.message ?? "Verification failed. Please try again.")
        setPhase("otp")
        return
      }

      setPhase("done")
      onVerified(email)
    } catch {
      setError("Network error. Please try again.")
      setPhase("otp")
    }
  }, [otp, checkoutSessionId, email, onVerified])

  const handleReset = useCallback(() => {
    setPhase("idle")
    setOtp("")
    setError(null)
    setResendCooldown(0)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    onReset?.()
  }, [onReset])

  // ── Done state ──────────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 shadow-xs">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1">
          <p className="text-sm font-extrabold text-foreground">Email Verified</p>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
        <button onClick={handleReset} className="text-xs font-bold text-amber-600 hover:underline">
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-white dark:bg-card p-5 space-y-4 shadow-sm">
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-extrabold text-foreground">Email Verification</p>
          <span className="ml-auto text-[10px] text-amber-700 dark:text-amber-300 font-extrabold border border-amber-500/30 bg-amber-500/10 rounded-full px-2 py-0.5 uppercase tracking-wider">
            Required
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          A verification code will be sent to{" "}
          <strong className="text-foreground">{email || "your billing email"}</strong>.
          You must verify your billing email before proceeding to payment.
        </p>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <p className="text-xs font-semibold text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Idle / Error — show send button */}
        {(phase === "idle" || phase === "error") && (
          <button
            onClick={handleSendOtp}
            disabled={!email.trim() || resendCooldown > 0}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 px-4 py-3 text-sm font-extrabold text-white shadow-md disabled:opacity-50 transition-all cursor-pointer"
          >
            <Mail className="h-4 w-4" />
            <span>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Send Verification Code"}</span>
          </button>
        )}

        {/* Sending */}
        {phase === "sending" && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            Sending code to {email}…
          </div>
        )}

        {/* OTP input */}
        {phase === "otp" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Code sent to <strong className="text-foreground">{email}</strong>. Check your inbox & spam folder.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                maxLength={8}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/[^a-fA-F0-9]/g, "").toUpperCase().slice(0, 8))}
                placeholder="A3F7B2C9"
                autoFocus
                className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-foreground focus:ring-2 focus:ring-amber-500/30 uppercase"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={otp.length < 6}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Verify
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <button onClick={handleReset} className="flex items-center gap-1 hover:text-foreground font-semibold">
                <RefreshCw className="h-3 w-3" /> Change email
              </button>
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button onClick={handleSendOtp} className="hover:text-foreground font-semibold">
                  Resend code
                </button>
              )}
            </div>
          </div>
        )}

        {/* Verifying */}
        {phase === "verifying" && (
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Verifying code…
          </div>
        )}
      </div>
    </div>
  )
}
