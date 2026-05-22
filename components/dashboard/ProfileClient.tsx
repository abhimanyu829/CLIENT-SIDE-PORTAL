"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"

export default function ProfileClient({ user }: { user: any }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  
  const [formData, setFormData] = useState({
    name: user.name || "",
    phone: user.phone || "",
    timezone: user.timezone || "UTC",
    notifPrefs: {
      email: user.notifPrefs?.email ?? true,
      sms: user.notifPrefs?.sms ?? false,
      slack: user.notifPrefs?.slack ?? false,
    }
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        alert("Profile updated successfully")
        router.refresh()
      } else {
        alert("Failed to update profile")
      }
    } catch {
      alert("Error saving profile")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold">Profile & Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your account details and preferences.</p>
      </div>

      <div className="dash-glass p-6 rounded-2xl border-white/5">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b border-white/5 pb-2">Personal Info</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Full Name</label>
                <input 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" 
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Email Address (Read Only)</label>
                <input 
                  value={user.email}
                  disabled
                  className="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none text-zinc-500 cursor-not-allowed" 
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Phone Number</label>
                <input 
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500" 
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1.5 block">Timezone</label>
                <select 
                  value={formData.timezone}
                  onChange={e => setFormData({...formData, timezone: e.target.value})}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-purple-500"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                  <option value="Europe/London">London (GMT)</option>
                  <option value="Asia/Kolkata">India (IST)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4">
            <h3 className="text-lg font-semibold border-b border-white/5 pb-2">Notifications</h3>
            <div className="space-y-3">
              {['email', 'sms', 'slack'].map(key => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.notifPrefs[key as keyof typeof formData.notifPrefs]}
                    onChange={e => setFormData({
                      ...formData, 
                      notifPrefs: { ...formData.notifPrefs, [key]: e.target.checked }
                    })}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 text-purple-500 focus:ring-purple-500 focus:ring-offset-black"
                  />
                  <span className="text-sm capitalize">{key} Notifications</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-6 border-t border-white/5 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="dash-btn px-6 py-2.5 rounded-lg text-sm font-medium transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
