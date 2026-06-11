"use client"

import { useState, useEffect, useCallback } from "react"

interface PreviewModalProps {
  previewUrl: string
  expiresAt: string
  productName: string
  productSlug: string
  onClose: () => void
}

export default function PreviewModal({ previewUrl, expiresAt, productName, productSlug, onClose }: PreviewModalProps) {
  const [remaining, setRemaining] = useState(() => {
    const diff = new Date(expiresAt).getTime() - Date.now()
    return Math.max(0, Math.floor(diff / 1000))
  })
  const [expired, setExpired] = useState(remaining <= 0)

  useEffect(() => {
    if (remaining <= 0) { setExpired(true); return }
    const timer = setInterval(() => {
      setRemaining(prev => {
        const next = prev - 1
        if (next <= 0) { setExpired(true); clearInterval(timer); return 0 }
        return next
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [remaining])

  const minutes = Math.floor(remaining / 60)
  const seconds = remaining % 60

  const handleBuyNow = useCallback(() => {
    window.location.href = `/checkout?product=${productSlug}`
  }, [productSlug])

  useEffect(() => {
    if (expired) {
      const timeout = setTimeout(onClose, 5000)
      return () => clearTimeout(timeout)
    }
  }, [expired, onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-950">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-white">⚡ Preview: {productName}</span>
          {!expired && (
            <span className="text-xs font-mono px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {minutes}:{seconds.toString().padStart(2, "0")} remaining
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleBuyNow}
            className="px-4 py-1.5 rounded-lg text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all shadow-lg shadow-purple-500/20">
            Buy Now to Keep Access
          </button>
          <button onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            ✕ Close
          </button>
        </div>
      </div>

      {/* Content */}
      {expired ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4">
          <div className="text-6xl">⏰</div>
          <h2 className="text-2xl font-black text-white">Preview Session Expired</h2>
          <p className="text-zinc-400 text-center max-w-md">
            Your preview of <span className="text-white font-semibold">{productName}</span> has ended.
            Purchase now to get full, unlimited access.
          </p>
          <div className="flex gap-3">
            <button onClick={handleBuyNow}
              className="px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:scale-105 transition-all shadow-lg shadow-purple-500/20">
              Purchase {productName}
            </button>
            <button onClick={onClose}
              className="px-6 py-3 rounded-xl text-sm font-medium glass text-zinc-300 hover:text-white transition-all">
              Back to Marketplace
            </button>
          </div>
        </div>
      ) : (
        <iframe
          src={previewUrl}
          className="flex-1 w-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          title={`Preview: ${productName}`}
        />
      )}
    </div>
  )
}