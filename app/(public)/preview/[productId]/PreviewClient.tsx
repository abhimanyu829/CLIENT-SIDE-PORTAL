"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/hooks/useAuth"

interface Product {
  id: string
  name: string
  slug: string
  tagline: string
  thumbnailUrl: string | null
  previewEnabled: boolean
  previewConfig: any
  status: string
  type: string
}

interface PreviewSession {
  sessionId: string
  expiresAt: string
  timeoutMinutes: number
  remainingPreviews: number
  error?: string
  code?: string
}

export default function PreviewClient({ product }: { product: Product }) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [sessionData, setSessionData] = useState<PreviewSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number>(0)

  const startPreview = useCallback(async () => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/preview/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.code === "ALREADY_OWNED") {
          setError("You already own this product. No preview needed!")
          return
        }
        if (data.code === "PREVIEW_LIMIT_REACHED") {
          setError(data.message || "Preview limit reached")
          return
        }
        setError(data.error || "Failed to start preview")
        return
      }

      setSessionData(data)
    } catch {
      setError("Failed to start preview session")
    } finally {
      setLoading(false)
    }
  }, [product.id, isAuthenticated, isLoading, router])

  useEffect(() => {
    startPreview()
  }, [startPreview])

  // Countdown timer
  useEffect(() => {
    if (!sessionData?.expiresAt) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, new Date(sessionData.expiresAt).getTime() - Date.now())
      setTimeLeft(remaining)
      if (remaining <= 0) {
        setError("Preview session expired. Please start a new session.")
        setSessionData(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [sessionData?.expiresAt])

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  const config = product.previewConfig ?? {}
  const envType = config.environmentType ?? "container"
  const previewUrl = config.url

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header bar */}
      <div className="border-b border-white/10 bg-black/80 backdrop-blur-xl px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          {product.thumbnailUrl && (
            <img src={product.thumbnailUrl} alt="" className="w-8 h-8 rounded-lg object-cover" />
          )}
          <div>
            <h1 className="text-sm font-bold">{product.name}</h1>
            <p className="text-xs text-zinc-500">Live Preview • {envType} environment</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {sessionData && timeLeft > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-zinc-400">Session expires in</span>
              <span className="font-mono text-amber-400 font-bold">{formatTime(timeLeft)}</span>
            </div>
          )}
          {sessionData && (
            <span className="text-xs text-zinc-500">
              {sessionData.remainingPreviews} previews remaining this month
            </span>
          )}
          <a
            href={`/marketplace/${product.slug}`}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Back to product →
          </a>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center">
        {loading ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-zinc-400">Initializing preview environment...</p>
          </div>
        ) : error ? (
          <div className="text-center space-y-4 max-w-md px-4">
            <div className="text-5xl">⚠️</div>
            <h2 className="text-xl font-bold">Preview Unavailable</h2>
            <p className="text-zinc-400">{error}</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={startPreview}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-600 transition-colors"
              >
                Try Again
              </button>
              <a
                href={`/marketplace/${product.slug}`}
                className="px-4 py-2 rounded-lg border border-white/10 text-zinc-300 text-sm font-semibold hover:bg-white/5 transition-colors"
              >
                View Product
              </a>
            </div>
          </div>
        ) : sessionData ? (
          previewUrl ? (
            <div className="w-full h-full flex flex-col bg-zinc-950">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected to {envType}
                </div>
                <a href={previewUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  Open in new tab ↗
                </a>
              </div>
              <iframe
                src={previewUrl}
                className="w-full flex-1 border-0"
                title={`${product.name} Preview`}
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          ) : (
            <div className="text-center space-y-6 max-w-lg px-4">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mx-auto">
                <span className="text-4xl">🚀</span>
              </div>
              <h2 className="text-2xl font-bold">{product.name} Preview</h2>
              <p className="text-zinc-400">
                The live preview environment is being provisioned. This is a placeholder — the actual
                {" "}{envType} environment will be connected here once the URL is configured.
              </p>
              <div className="glass rounded-xl p-4 text-left space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Session ID</span>
                  <span className="font-mono text-zinc-300">{sessionData.sessionId.slice(0, 16)}...</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Environment</span>
                  <span className="text-zinc-300 capitalize">{envType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Timeout</span>
                  <span className="text-zinc-300">{sessionData.timeoutMinutes} minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Remaining previews</span>
                  <span className="text-zinc-300">{sessionData.remainingPreviews}</span>
                </div>
              </div>
              <div className="flex gap-3 justify-center">
                <a
                  href={`/checkout?product=${product.slug}`}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-sm hover:scale-105 transition-transform"
                >
                  Purchase Full Access →
                </a>
                <a
                  href={`/marketplace/${product.slug}`}
                  className="px-6 py-3 rounded-xl border border-white/10 text-zinc-300 font-semibold text-sm hover:bg-white/5 transition-colors"
                >
                  Back to Product
                </a>
              </div>
            </div>
          )
        ) : null}
      </div>

      <style>{`
        .glass { background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.08); }
      `}</style>
    </div>
  )
}
