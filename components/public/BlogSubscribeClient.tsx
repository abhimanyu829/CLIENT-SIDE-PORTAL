"use client"

import { useState } from "react"
import { CheckCircle2, ArrowRight, Loader2 } from "lucide-react"

interface BlogSubscribeClientProps {
  buttonText?: string
  placeholder?: string
  className?: string
}

export function BlogSubscribeClient({
  buttonText = "Subscribe →",
  placeholder = "you@startup.com",
  className = "",
}: BlogSubscribeClientProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/public/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setSuccess(true)
        setEmail("")
      } else {
        setError(data.error || "Failed to subscribe. Please try again.")
      }
    } catch {
      setError("Network error. Please try again later.")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="flex items-center justify-center gap-2 text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 rounded-xl px-5 py-3.5 text-sm font-medium">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>You are subscribed! Check your inbox for confirmation.</span>
      </div>
    )
  }

  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
        <input
          type="email"
          required
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className="flex-1 glass rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-purple-500/50 bg-black/40 border border-white/10"
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-gradient px-6 py-3 rounded-xl font-bold text-white text-sm hover:scale-105 transition-all whitespace-nowrap flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Subscribing...
            </>
          ) : (
            buttonText
          )}
        </button>
      </form>
      {error && <p className="text-red-400 text-xs mt-2 text-center">{error}</p>}
    </div>
  )
}

