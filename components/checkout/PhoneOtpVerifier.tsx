"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Phone, ShieldCheck, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"

type Phase = "idle" | "sending" | "otp" | "verifying" | "done" | "error"

interface Props {
  onVerified: (phone: string) => void
  onReset?: () => void
  defaultPhone?: string
}

/**
 * Twilio phone-OTP verifier for the checkout billing step.
 * Talks to the existing backend endpoints:
 *   POST /api/auth/otp/send    { phone }
 *   POST /api/auth/otp/verify  { phone, code }
 * The server persists the verified state; the backend payment gate re-checks
 * it independently, so this UI is only a convenience — never a security layer.
 */
export default function PhoneOtpVerifier({ onVerified, onReset, defaultPhone = "" }: Props) {
  const [phone, setPhone] = useState(defaultPhone)
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

  const validatePhone = (p: string) => /^\+[1-9]\d{6,14}$/.test(p.trim())

  const handleSendOtp = useCallback(async () => {
    setError(null)
    const trimmedPhone = phone.trim()

    if (!validatePhone(trimmedPhone)) {
      setError("Enter a valid phone number with country code. Example: +911111111111")
      return
    }

    setPhase("sending")
    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmedPhone }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        const code = data.error?.code
        if (data.cooldownSeconds || code === "OTP_COOLDOWN") {
          startCooldown(data.cooldownSeconds ?? 60)
        }
        if (data.alreadyVerified) {
          // Server says this number is already verified — accept it.
          setPhase("done")
          onVerified(trimmedPhone)
          return
        }
        setError(data.error?.message ?? "Failed to send verification code.")
        setPhase("error")
        return
      }

      setPhase("otp")
      startCooldown(data.cooldownSeconds ?? 60)
    } catch (err) {
      console.error("[PhoneOtpVerifier] sendOtp:", err)
      setError("Network error. Please check your connection and try again.")
      setPhase("error")
    }
  }, [phone, startCooldown, onVerified])

  const handleVerifyOtp = useCallback(async () => {
    if (otp.trim().length !== 6) return
    setError(null)
    setPhase("verifying")

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error?.message ?? "Verification failed. Please try again.")
        setPhase("otp")
        return
      }

      setPhase("done")
      onVerified(phone.trim())
    } catch (err) {
      console.error("[PhoneOtpVerifier] verifyOtp:", err)
      setError("Network error. Please try again.")
      setPhase("otp")
    }
  }, [otp, phone, onVerified])

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
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">Phone Verified</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500">{phone}</p>
        </div>
        <button onClick={handleReset} className="text-xs text-emerald-600 hover:text-emerald-400 underline">
          Change
        </button>
      </div>
    )
  }

  const p: Phase = phase

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-foreground">Phone Verification</p>
          <span className="ml-auto text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
            Required for payment
          </span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <p className="text-xs text-red-600 dark:text-red-300">{error}</p>
          </div>
        )}

        {(phase === "idle" || phase === "error") && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-border bg-white dark:bg-zinc-950 pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={!phone.trim() || p === "sending"}
              className="rounded-lg bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
            >
              {p === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
            </button>
          </div>
        )}

        {phase === "sending" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            Sending OTP to {phone}…
          </div>
        )}

        {phase === "otp" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              6-digit code sent to <span className="text-foreground font-semibold">{phone}</span>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="flex-1 rounded-lg border border-border bg-white dark:bg-zinc-950 px-3 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-foreground placeholder:text-muted-foreground focus:border-amber-500 focus:outline-none"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || p === "verifying"}
                className="rounded-lg bg-emerald-700 hover:bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              >
                {p === "verifying" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button onClick={handleReset} className="flex items-center gap-1 hover:text-foreground">
                <RefreshCw className="h-3 w-3" /> Change number
              </button>
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button onClick={handleSendOtp} className="hover:text-foreground">
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "verifying" && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
            Verifying OTP…
          </div>
        )}
      </div>
    </div>
  )
}
