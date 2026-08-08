"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
  type Auth,
} from "firebase/auth"
import { Phone, ShieldCheck, Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react"

type Phase = "idle" | "sending" | "otp" | "verifying" | "done" | "error"

interface Props {
  onVerified: (phone: string) => void
  onReset?: () => void
  defaultPhone?: string
}

export default function PhoneOtpVerifier({ onVerified, onReset, defaultPhone = "" }: Props) {
  const [phone, setPhone] = useState(defaultPhone)
  const [otp, setOtp] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const authRef = useRef<Auth | null>(null)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
      try { recaptchaRef.current?.clear() } catch {}
    }
  }, [])

  const startCooldown = useCallback(() => {
    setResendCooldown(60)
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

  const validatePhone = (p: string) => /^\+[1-9]\d{6,14}$/.test(p)

  const initAuth = useCallback(async () => {
    if (authRef.current) return authRef.current
    const { firebaseAuth } = await import("@/lib/firebase-client")
    authRef.current = firebaseAuth
    return firebaseAuth
  }, [])

  // Create the verifier ONCE per "session" and reuse it — don't clear/recreate
  // on every send, since tearing down and rebuilding the widget rapidly is a
  // known trigger for internal-error on some Firebase project configs.
  const getRecaptcha = useCallback(async (auth: Auth) => {
    if (recaptchaRef.current) return recaptchaRef.current
    const container = document.getElementById("recaptcha-container")
    if (!container) {
      throw new Error("reCAPTCHA container not found in DOM")
    }
    const verifier = new RecaptchaVerifier(auth, container, {
      size: "invisible",
      callback: () => {},
      "expired-callback": () => {
        try { recaptchaRef.current?.clear() } catch {}
        recaptchaRef.current = null
      },
    })
    recaptchaRef.current = verifier
    return verifier
  }, [])

  const handleSendOtp = useCallback(async () => {
    setError(null)
    const trimmedPhone = phone.trim()

    if (!validatePhone(trimmedPhone)) {
      setError("Enter a valid phone number with country code. Example: +911111111111")
      return
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
    if (!apiKey || !authDomain) {
      setError("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN in .env and restart the server.")
      return
    }

    setPhase("sending")
    try {
      const auth = await initAuth()
      const verifier = await getRecaptcha(auth)
      const result = await signInWithPhoneNumber(auth, trimmedPhone, verifier)
      confirmationRef.current = result
      setPhase("otp")
      startCooldown()
    } catch (err: any) {
      console.error("[PhoneOtpVerifier] sendOtp:", err)
      // On internal-error specifically, force a full teardown/rebuild next attempt
      try { recaptchaRef.current?.clear() } catch {}
      recaptchaRef.current = null
      setError(
        err?.code === "auth/invalid-phone-number"
          ? "Invalid phone number. Use E.164 format: +919876543210"
          : err?.code === "auth/too-many-requests"
          ? "Too many attempts. Please try again later."
          : err?.code === "auth/quota-exceeded"
          ? "SMS quota exceeded. Contact support."
          : err?.code === "auth/internal-error"
          ? "Firebase internal error. Check: (1) Identity Toolkit API is enabled in Google Cloud Console, (2) no ad-blocker/extension is blocking recaptcha.google.com in your browser Network tab, (3) third-party cookies aren't blocked for this site."
          : err?.code === "auth/operation-not-allowed"
          ? "Phone sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method → Phone."
          : "Failed to send OTP. Check your number and try again."
      )
      setPhase("error")
    }
  }, [phone, initAuth, getRecaptcha, startCooldown])

  const handleVerifyOtp = useCallback(async () => {
    if (!confirmationRef.current || otp.length !== 6) return
    setError(null)
    setPhase("verifying")

    try {
      const result = await confirmationRef.current.confirm(otp)
      const idToken = await result.user.getIdToken()

      const res = await fetch("/api/auth/verify-phone-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, phone: phone.trim() }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Backend verification failed")
      }

      setPhase("done")
      onVerified(phone.trim())
    } catch (err: any) {
      console.error("[PhoneOtpVerifier] verifyOtp:", err)
      setError(
        err?.code === "auth/invalid-verification-code"
          ? "Incorrect OTP. Please try again."
          : err?.code === "auth/code-expired"
          ? "OTP expired. Request a new code."
          : err?.message || "Verification failed. Please try again."
      )
      setPhase("error")
    }
  }, [otp, phone, onVerified])

  const handleReset = useCallback(() => {
    setPhase("idle")
    setOtp("")
    setError(null)
    setResendCooldown(0)
    confirmationRef.current = null
    try { recaptchaRef.current?.clear() } catch {}
    recaptchaRef.current = null
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    onReset?.()
  }, [onReset])

  if (phase === "done") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-700/50 bg-emerald-900/20 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-emerald-300">Phone Verified</p>
          <p className="text-xs text-emerald-500">{phone}</p>
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
      {/* Keep this div mounted at all times (even in "done" branch above it's
          unmounted — that's fine since we clear the verifier on reset anyway) */}
      <div id="recaptcha-container" />

      <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-violet-400" />
          <p className="text-sm font-semibold text-zinc-200">Phone Verification</p>
          <span className="ml-auto text-[10px] text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">Optional</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-700/40 bg-red-900/10 px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {(phase === "idle" || phase === "error") && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-9 pr-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <button
              onClick={handleSendOtp}
              disabled={!phone.trim() || p === "sending"}
              className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {p === "sending" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP"}
            </button>
          </div>
        )}

        {phase === "sending" && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            Sending OTP to {phone}…
          </div>
        )}

        {phase === "otp" && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              6-digit code sent to <span className="text-zinc-300 font-semibold">{phone}</span>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-center text-lg font-mono tracking-[0.5em] text-white placeholder-zinc-700 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6 || p === "verifying"}
                className="rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50 transition-colors"
              >
                {p === "verifying" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
              </button>
            </div>
            <div className="flex items-center justify-between text-xs text-zinc-600">
              <button onClick={handleReset} className="flex items-center gap-1 hover:text-zinc-400">
                <RefreshCw className="h-3 w-3" /> Change number
              </button>
              {resendCooldown > 0 ? (
                <span>Resend in {resendCooldown}s</span>
              ) : (
                <button onClick={handleSendOtp} className="hover:text-zinc-400">
                  Resend OTP
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "verifying" && (
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            Verifying OTP…
          </div>
        )}
      </div>
    </div>
  )
}