"use client"

import { useState } from "react"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

export default function ResetPasswordClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    
    setLoading(true)
    setError("")
    
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      })
      
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || "Failed to reset password")
      
      setSuccess(true)
      setTimeout(() => router.push("/login"), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black mb-2 text-white">Reset Password</h1>
        <p className="text-zinc-400 text-sm">Enter your new password below.</p>
      </div>

      {success ? (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto text-2xl">✓</div>
          <p className="text-green-400 font-medium">Password successfully reset!</p>
          <p className="text-zinc-500 text-sm">Redirecting to login...</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">New Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={e=>setPassword(e.target.value)} 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-colors" 
              placeholder="••••••••" 
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Confirm Password</label>
            <input 
              type="password" 
              value={confirmPassword} 
              onChange={e=>setConfirmPassword(e.target.value)} 
              required 
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-purple-500/50 transition-colors" 
              placeholder="••••••••" 
            />
          </div>

          <button 
            disabled={loading || !token} 
            className="w-full mt-4 bg-white text-black font-bold rounded-xl py-3 hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
      )}

      <div className="mt-8 text-center border-t border-white/10 pt-6">
        <Link href="/login" className="text-sm font-medium text-zinc-400 hover:text-white transition-colors">
          Return to Login
        </Link>
      </div>
    </div>
  )
}
