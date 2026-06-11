"use client"

import { useState } from "react"

interface PreviewConfigFormProps {
  productId: string
  initialEnabled: boolean
  initialConfig: any
}

export function PreviewConfigForm({ productId, initialEnabled, initialConfig }: PreviewConfigFormProps) {
  const [previewEnabled, setPreviewEnabled] = useState(initialEnabled)
  const [sessionTimeout, setSessionTimeout] = useState(initialConfig?.sessionTimeoutMinutes ?? 6)
  const [maxPreviewsPerUser, setMaxPreviewsPerUser] = useState(initialConfig?.maxPreviewsPerUser ?? 5)
  const [environmentType, setEnvironmentType] = useState(initialConfig?.environmentType ?? "container")
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/products/${productId}/preview-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewEnabled,
          previewConfig: {
            sessionTimeoutMinutes: sessionTimeout,
            maxPreviewsPerUser,
            environmentType,
          },
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to save")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <h3 className="text-lg font-bold text-white">Preview Configuration</h3>

      <div className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={previewEnabled}
          onClick={() => setPreviewEnabled(!previewEnabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${previewEnabled ? "bg-purple-500" : "bg-zinc-700"}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${previewEnabled ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <span className="text-sm text-zinc-300">{previewEnabled ? "Preview enabled" : "Preview disabled"}</span>
      </div>

      {previewEnabled && (
        <div className="space-y-3 pl-1">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Session Timeout (minutes)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={sessionTimeout}
              onChange={e => setSessionTimeout(Number(e.target.value))}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Max Previews per User</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxPreviewsPerUser}
              onChange={e => setMaxPreviewsPerUser(Number(e.target.value))}
              className="w-24 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Environment Type</label>
            <select
              value={environmentType}
              onChange={e => setEnvironmentType(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="container">Container</option>
              <option value="sandbox">Sandbox</option>
              <option value="live">Live Demo</option>
              <option value="staging">Staging</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-purple-600 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Preview Config"}
        </button>
        {saved && <span className="text-sm text-emerald-400">Saved!</span>}
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>
    </div>
  )
}