"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

interface PreviewSandboxProps {
  sessionId: string
  token: string
  previewUrl: string | null
  expiresAt: string
  productName: string
  productSlug: string
  remainingSeconds: number
  isExpired: boolean
  isRevoked: boolean
}

export default function PreviewSandbox({
  sessionId,
  token,
  previewUrl,
  expiresAt,
  productName,
  productSlug,
  remainingSeconds: initialRemaining,
  isExpired: initialExpired,
  isRevoked,
}: PreviewSandboxProps) {
  const [remaining, setRemaining] = useState(Math.max(0, initialRemaining))
  const [expired, setExpired] = useState(initialExpired || initialRemaining <= 0)
  const [heartbeatError, setHeartbeatError] = useState(false)

  // Countdown timer
  useEffect(() => {
    if (remaining <= 0) { setExpired(true); return }
    const timer = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1
        if (next <= 0) { setExpired(true); return 0 }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [remaining])

  // Heartbeat: update lastActivityAt every 30s
  useEffect(() => {
    if (expired || isRevoked) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/demos/${sessionId}?token=${token}`, { method: "GET" })
        if (!res.ok) setHeartbeatError(true)
        else setHeartbeatError(false)
      } catch {
        setHeartbeatError(true)
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [sessionId, token, expired, isRevoked])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60
  const urgentTime = remaining < 60 && remaining > 0

  const handleBuyNow = useCallback(() => {
    window.location.href = `/checkout?product=${productSlug}`
  }, [productSlug])

  // Revoked state
  if (isRevoked) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-6">🚫</div>
          <h2 className="text-3xl font-black mb-3">Session Revoked</h2>
          <p className="text-zinc-400 mb-8">This preview session has been revoked by an administrator.</p>
          <Link href="/marketplace" className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all">
            Browse Marketplace
          </Link>
        </div>
      </div>
    )
  }

  // Expired state
  if (expired) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="text-6xl mb-6">⏰</div>
          <h2 className="text-3xl font-black mb-3">Preview Session Expired</h2>
          <p className="text-zinc-400 mb-8">
            Your preview of <span className="text-white font-semibold">{productName}</span> has ended.
            Purchase now to get full, unlimited access.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={handleBuyNow}
              className="px-8 py-3 rounded-xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all">
              Purchase {productName}
            </button>
            <Link href="/marketplace"
              className="px-8 py-3 rounded-xl font-bold text-zinc-300 hover:text-white border border-white/10 hover:border-purple-500/50 transition-all text-center">
              Browse Marketplace
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Live preview with iframe
  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 bg-zinc-950 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <Link href="/marketplace" className="text-sm font-bold text-zinc-300 hover:text-white transition-colors">
            <span className="text-lg">⬡</span> NexusAI
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-sm font-semibold text-white">⚡ Preview: {productName}</span>
          <span className={`text-xs font-mono px-2 py-1 rounded-full ${urgentTime ? "bg-red-500/20 text-red-300 border border-red-500/30" : "bg-purple-500/20 text-purple-300 border border-purple-500/30"}`}>
            {minutes}:{seconds.toString().padStart(2, "0")} remaining
          </span>
          {heartbeatError && (
            <span className="text-xs text-amber-400">⚠ Connection unstable</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleBuyNow}
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all shadow-lg shadow-purple-500/20">
            Buy Now to Keep Access
          </button>
          <Link href="/marketplace"
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white transition-all">
            ✕ Close
          </Link>
        </div>
      </header>

      {/* Iframe content */}
      {previewUrl ? (
        <iframe
          src={previewUrl}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={`Preview: ${productName}`}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-4">⚡</div>
            <p className="text-zinc-400">Loading preview environment...</p>
          </div>
        </div>
      )}

      {/* Sticky CTA when time is running low */}
      {remaining < 120 && remaining > 0 && (
        <div className="absolute bottom-4 right-4 z-20">
          <button onClick={handleBuyNow}
            className="px-5 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all shadow-lg shadow-purple-500/30 border border-purple-400/30">
            ⚡ Get unlimited access
          </button>
        </div>
      )}
    </div>
  )
}